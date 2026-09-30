import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createInitialState,
  finishCourseSession,
  getCourseSnapshot,
  reviewPhrase,
  startCourseSession,
} from "../src/domain/course.ts";

const START = new Date("2026-09-13T10:00:00.000Z");

test("a baseline session advances the course and stores useful memory", () => {
  const initial = createInitialState(START);
  const started = startCourseSession(initial, { availableMinutes: 75 }, START);

  assert.equal(started.created, true);
  assert.equal(started.state.activeSession?.missionId, "week-0-day-0");

  const finished = finishCourseSession(
    started.state,
    {
      activeMinutes: 52,
      outcome: "completed",
      wins: ["Introduced himself without a script"],
      corrections: [
        {
          observed: "Eu sou em Lisboa",
          improved: "Estou em Lisboa",
          category: "grammar",
        },
      ],
      newPhrases: [
        {
          portuguese: "Pode repetir, por favor?",
          meaning: "Can you repeat, please?",
          context: "Repairing a fast conversation",
        },
      ],
      learnerTalkPercent: 64,
    },
    new Date("2026-09-13T11:00:00.000Z"),
  );

  assert.equal(finished.state.profile.currentWeek, 1);
  assert.equal(finished.state.profile.currentDay, 1);
  assert.equal(finished.state.profile.status, "active");
  assert.equal(finished.state.activeSession, undefined);
  assert.equal(finished.state.sessions.length, 1);
  assert.equal(finished.state.phrases.length, 1);
  assert.equal(finished.state.errors.length, 1);

  const snapshot = getCourseSnapshot(
    finished.state,
    new Date("2026-09-13T11:00:01.000Z"),
  );
  assert.equal(snapshot.stats.dueCount, 1);
  assert.equal(snapshot.stats.totalMinutes, 52);
  assert.equal(snapshot.mission.week, 1);
  assert.match(snapshot.voicePrompt, /Pode repetir/u);
});

test("repeated phrases are deduplicated and recurring errors gain frequency", () => {
  const baseline = startCourseSession(
    createInitialState(START),
    { availableMinutes: 45 },
    START,
  );
  const first = finishCourseSession(
    baseline.state,
    {
      activeMinutes: 40,
      outcome: "completed",
      wins: [],
      corrections: [
        {
          observed: "sou cansado",
          improved: "estou cansado",
          category: "grammar",
        },
      ],
      newPhrases: [
        {
          portuguese: "Com licença",
          meaning: "Excuse me",
          context: "Getting attention",
        },
      ],
    },
    new Date("2026-09-13T11:00:00.000Z"),
  );
  const secondStart = startCourseSession(
    first.state,
    { availableMinutes: 45 },
    new Date("2026-09-14T10:00:00.000Z"),
  );
  const second = finishCourseSession(
    secondStart.state,
    {
      activeMinutes: 45,
      outcome: "partial",
      wins: [],
      corrections: [
        {
          observed: "Sou cansado",
          improved: "Estou cansado",
          category: "grammar",
        },
      ],
      newPhrases: [
        {
          portuguese: "  Com licença ",
          meaning: "Excuse me",
          context: "Passing someone",
        },
      ],
    },
    new Date("2026-09-14T11:00:00.000Z"),
  );

  assert.equal(second.state.phrases.length, 1);
  assert.equal(second.state.errors.length, 1);
  assert.equal(second.state.errors[0]?.occurrences, 2);
});

test("successful and failed retrieval schedule different next reviews", () => {
  const baseline = startCourseSession(
    createInitialState(START),
    { availableMinutes: 45 },
    START,
  );
  const finished = finishCourseSession(
    baseline.state,
    {
      activeMinutes: 45,
      outcome: "completed",
      wins: [],
      corrections: [],
      newPhrases: [
        {
          portuguese: "Já percebi",
          meaning: "I understand now",
          context: "Conversation repair",
        },
      ],
    },
    START,
  );
  const phraseId = finished.state.phrases[0]?.id;
  assert.ok(phraseId);

  const passed = reviewPhrase(finished.state, phraseId, true, START);
  assert.equal(passed.phrase.stage, 1);
  assert.equal(passed.phrase.nextReviewAt, "2026-09-14T10:00:00.000Z");

  const missed = reviewPhrase(passed.state, phraseId, false, START);
  assert.equal(missed.phrase.stage, 0);
  assert.equal(missed.phrase.lapses, 1);
  assert.equal(missed.phrase.nextReviewAt, "2026-09-14T10:00:00.000Z");
});

test("an incomplete mission stays in place and becomes a repair block", () => {
  const baseline = startCourseSession(
    createInitialState(START),
    { availableMinutes: 45 },
    START,
  );
  const finished = finishCourseSession(
    baseline.state,
    {
      activeMinutes: 20,
      outcome: "blocked",
      wins: [],
      corrections: [],
      newPhrases: [],
    },
    START,
  );

  assert.equal(finished.state.profile.currentWeek, 0);
  assert.equal(finished.state.profile.currentDay, 0);
  assert.equal(finished.state.profile.status, "repair");
  assert.equal(
    getCourseSnapshot(finished.state, START).mission.label,
    "Repair block",
  );
});
