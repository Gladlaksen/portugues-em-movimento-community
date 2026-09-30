import { randomUUID } from "node:crypto";

import {
  courseStateSchema,
  finishSessionInputSchema,
  startSessionInputSchema,
  type CourseState,
  type FinishSessionInput,
  type Phrase,
  type StartSessionInput,
} from "./model.ts";

export type WeekPlan = {
  week: number;
  title: string;
  mission: string;
  languageFocus: string;
  personalApplication: string;
};

export type CourseMission = {
  id: string;
  week: number;
  day: number;
  label: string;
  title: string;
  objective: string;
  languageFocus: string;
  personalApplication: string;
};

export type CourseSnapshot = {
  revision: number;
  updatedAt: string;
  profile: CourseState["profile"];
  activeSession?: CourseState["activeSession"];
  mission: CourseMission;
  duePhrases: CourseState["phrases"];
  topErrors: CourseState["errors"];
  recentSessions: CourseState["sessions"];
  route: WeekPlan[];
  stats: {
    streakDays: number;
    totalMinutes: number;
    minutesThisWeek: number;
    sessionsCompleted: number;
    activePhrases: number;
    masteredPhrases: number;
    dueCount: number;
    progressPercent: number;
  };
  voicePrompt: string;
};

export const WEEK_PLAN: WeekPlan[] = [
  {
    week: 0,
    title: "Baseline",
    mission: "Map the starting point and set the voice system up",
    languageFocus: "Sound map, comprehension and spontaneous speech",
    personalApplication: "Why Portugal and what functional fluency means",
  },
  {
    week: 1,
    title: "First contact",
    mission: "Establish contact and repair a simple conversation",
    languageFocus: "Greetings, identity, ser/estar, politeness and stress",
    personalApplication: "Introduce the learner and the move to Portugal",
  },
  {
    week: 2,
    title: "Food & arrangements",
    mission: "Order, ask follow-ups and make a simple arrangement",
    languageFocus: "Present tense, questions, articles and nasal sounds",
    personalApplication: "Food preferences, cafés and natural small talk",
  },
  {
    week: 3,
    title: "Home base",
    mission: "Discuss housing, neighbourhoods and daily routines",
    languageFocus: "Há, prepositions and reflexive verbs",
    personalApplication: "Viewings, rent and choosing an area",
  },
  {
    week: 4,
    title: "Moving around",
    mission: "Navigate Portugal and resolve a practical service problem",
    languageFocus: "Imperatives, time and movement verbs",
    personalApplication: "Transport, directions and everyday logistics",
  },
  {
    week: 5,
    title: "Social life",
    mission: "Connect, invite, plan and decline naturally",
    languageFocus: "Modal verbs, invitations and register",
    personalApplication: "Local relationships and social confidence",
  },
  {
    week: 6,
    title: "Health & surprises",
    mission: "Explain a health or unexpected problem precisely",
    languageFocus: "Body, symptoms, needs and the past",
    personalApplication: "Pharmacy, appointments and urgent clarification",
  },
  {
    week: 7,
    title: "Work & product",
    mission: "Explain a product, a decision and why it matters",
    languageFocus: "Work vocabulary, cause and structured explanation",
    personalApplication:
      "The learner's chosen work, hobbies and personal projects",
  },
  {
    week: 8,
    title: "Administration",
    mission: "Handle a formal process involving documents or conditions",
    languageFocus: "Formal register, documents and conditional language",
    personalApplication: "Banking, contracts, housing and relocation",
  },
  {
    week: 9,
    title: "Ideas & culture",
    mission: "Participate in a longer conversation and express nuance",
    languageFocus: "Cohesion, opinions, agreement and disagreement",
    personalApplication: "Portuguese culture, news and local context",
  },
  {
    week: 10,
    title: "Stories & plans",
    mission: "Tell a personal story and connect it to future plans",
    languageFocus: "Past contrasts, sequencing and the future",
    personalApplication: "the learner's background, work and move",
  },
  {
    week: 11,
    title: "Negotiation",
    mission: "Handle disagreement, uncertainty and a complex negotiation",
    languageFocus: "Argument, hypotheses and clarification",
    personalApplication: "Meetings, misunderstandings and trade-offs",
  },
  {
    week: 12,
    title: "Portuguese first",
    mission: "Operate for a full field block primarily in Portuguese",
    languageFocus: "Fluency strategies and self-correction",
    personalApplication: "Integrated daily life and final field test",
  },
];

const DAY_FOCUS = [
  "Baseline",
  "New mission",
  "Pattern control",
  "Natural listening",
  "Personal conversation",
  "Unexpected variation",
  "Real-world transfer",
  "Unseen field test",
] as const;

const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("pt-PT").replace(/\s+/gu, " ");
}

function mondayAtMidnight(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const weekday = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - weekday);
  return result;
}

function calculateStreak(state: CourseState, now: Date): number {
  const completedDays = new Set(
    state.sessions.map((session) =>
      localDateKey(new Date(session.completedAt)),
    ),
  );

  let cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);

  if (!completedDays.has(localDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (completedDays.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function createInitialState(now = new Date()): CourseState {
  const timestamp = now.toISOString();
  return courseStateSchema.parse({
    schemaVersion: 1,
    revision: 0,
    updatedAt: timestamp,
    profile: {
      learnerName: "Learner",
      explanationLanguage: "English",
      interests: [],
      targetVariant: "pt-PT",
      targetWeeks: 12,
      weeklyTargetMinutes: 840,
      currentWeek: 0,
      currentDay: 0,
      status: "baseline",
      startedAt: timestamp,
    },
    sessions: [],
    phrases: [],
    errors: [],
  });
}

export function getMission(state: CourseState): CourseMission {
  const week = WEEK_PLAN[state.profile.currentWeek] ?? WEEK_PLAN.at(-1);
  if (!week) {
    throw new Error("The course route is empty.");
  }

  const day =
    state.profile.currentWeek === 0 ? 0 : Math.max(1, state.profile.currentDay);
  const scheduledLabel = DAY_FOCUS[day] ?? DAY_FOCUS.at(-1) ?? "Field practice";
  const label =
    state.profile.status === "repair" ? "Repair block" : scheduledLabel;
  const title =
    state.profile.status === "repair"
      ? `Repair block: ${week.title}`
      : state.profile.currentWeek === 0
        ? week.mission
        : `${label}: ${week.title}`;

  return {
    id: `week-${week.week}-day-${day}`,
    week: week.week,
    day,
    label,
    title,
    objective: week.mission,
    languageFocus: week.languageFocus,
    personalApplication: week.personalApplication,
  };
}

function buildVoicePrompt(
  state: CourseState,
  mission: CourseMission,
  duePhrases: CourseState["phrases"],
  topErrors: CourseState["errors"],
): string {
  const activeNeed = state.activeSession?.realNeed;
  const due = duePhrases.length
    ? duePhrases
        .slice(0, 8)
        .map((phrase) => phrase.portuguese)
        .join(" · ")
    : "No stored phrases are due; begin with a short diagnostic recall.";
  const errors = topErrors.length
    ? topErrors
        .slice(0, 3)
        .map((error) => `${error.observed} → ${error.improved}`)
        .join(" · ")
    : "No recurring errors are stored yet.";

  return [
    "Start today's Português em Movimento voice session in European Portuguese (pt-PT).",
    `Mission: ${mission.title}. Objective: ${mission.objective}.`,
    `Language focus: ${mission.languageFocus}.`,
    `Learner: ${state.profile.learnerName}. Use ${state.profile.explanationLanguage} for brief explanations when needed.`,
    `Use roughly 70% daily life and 30% chosen interests: ${state.profile.interests.join(", ") || "ask the learner"}.`,
    activeNeed ? `Immediate real-life need: ${activeNeed}.` : "",
    `Test these due phrases before new material: ${due}`,
    `Prioritize these recurring errors: ${errors}`,
    "Use Recall → Ear → Pattern → Mission → Repair → Replay → Log. Ask one question at a time and keep me speaking at least 60%.",
    "Before saying goodbye at the end of useful practice, call portugues_finish_session with the evidenced log, including partial practice. The learner need not separately ask to save. In realtime voice, delegate the save to the backend and wait for the tool result.",
    "Confirm progress saved only after the tool succeeds. If saving fails or an actual approval is pending, report that it is still pending; do not invent app approval steps. Check status before retrying an uncertain save, and never start a new session just to log the previous one.",
    "A temporary pause is not the end of a lesson. If disconnected before saving, recover the active session on return. Do not invent performance data; label estimated active minutes as approximate in notes. With no useful practice, leave the session active. Closing the lesson does not itself authorize ending the voice call.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function getCourseSnapshot(
  state: CourseState,
  now = new Date(),
): CourseSnapshot {
  const duePhrases = state.phrases
    .filter(
      (phrase) =>
        phrase.status !== "mastered" &&
        new Date(phrase.nextReviewAt).getTime() <= now.getTime(),
    )
    .sort(
      (left, right) =>
        new Date(left.nextReviewAt).getTime() -
        new Date(right.nextReviewAt).getTime(),
    );

  const topErrors = state.errors
    .filter((error) => !error.resolvedAt)
    .sort((left, right) => {
      if (right.occurrences !== left.occurrences) {
        return right.occurrences - left.occurrences;
      }
      return (
        new Date(right.lastSeenAt).getTime() -
        new Date(left.lastSeenAt).getTime()
      );
    })
    .slice(0, 6);

  const mission = getMission(state);
  const startOfWeek = mondayAtMidnight(now).getTime();
  const totalMinutes = state.sessions.reduce(
    (sum, session) => sum + session.activeMinutes,
    0,
  );
  const minutesThisWeek = state.sessions
    .filter((session) => new Date(session.completedAt).getTime() >= startOfWeek)
    .reduce((sum, session) => sum + session.activeMinutes, 0);
  const completedDays =
    state.profile.currentWeek === 0
      ? 0
      : (state.profile.currentWeek - 1) * 7 +
        Math.max(0, state.profile.currentDay - 1);
  const progressPercent =
    state.profile.status === "completed"
      ? 100
      : Math.min(100, Math.round((completedDays / (12 * 7)) * 100));

  const snapshot: CourseSnapshot = {
    revision: state.revision,
    updatedAt: state.updatedAt,
    profile: state.profile,
    mission,
    duePhrases,
    topErrors,
    recentSessions: state.sessions.slice(-6).reverse(),
    route: WEEK_PLAN,
    stats: {
      streakDays: calculateStreak(state, now),
      totalMinutes,
      minutesThisWeek,
      sessionsCompleted: state.sessions.length,
      activePhrases: state.phrases.filter(
        (phrase) => phrase.status === "active",
      ).length,
      masteredPhrases: state.phrases.filter(
        (phrase) => phrase.status === "mastered",
      ).length,
      dueCount: duePhrases.length,
      progressPercent,
    },
    voicePrompt: "",
  };

  if (state.activeSession) {
    snapshot.activeSession = state.activeSession;
  }
  snapshot.voicePrompt = buildVoicePrompt(
    state,
    mission,
    duePhrases,
    topErrors,
  );
  return snapshot;
}

export function startCourseSession(
  state: CourseState,
  input: StartSessionInput,
  now = new Date(),
): { state: CourseState; created: boolean } {
  const parsed = startSessionInputSchema.parse(input);
  if (state.profile.status === "completed") {
    throw new Error("The 12-week route is already marked complete.");
  }
  if (state.activeSession) {
    return { state, created: false };
  }

  const mission = getMission(state);
  const activeSession: CourseState["activeSession"] = {
    id: randomUUID(),
    startedAt: now.toISOString(),
    week: mission.week,
    day: mission.day,
    missionId: mission.id,
    missionTitle: mission.title,
    objective: mission.objective,
    availableMinutes: parsed.availableMinutes,
  };
  if (parsed.realNeed) {
    activeSession.realNeed = parsed.realNeed;
  }

  return {
    created: true,
    state: courseStateSchema.parse({
      ...state,
      activeSession,
      updatedAt: now.toISOString(),
    }),
  };
}

function nextCoursePosition(
  profile: CourseState["profile"],
): CourseState["profile"] {
  if (profile.currentWeek === 0) {
    return { ...profile, currentWeek: 1, currentDay: 1, status: "active" };
  }
  if (profile.currentWeek === 12 && profile.currentDay >= 7) {
    return { ...profile, status: "completed" };
  }
  if (profile.currentDay >= 7) {
    return {
      ...profile,
      currentWeek: profile.currentWeek + 1,
      currentDay: 1,
      status: "active",
    };
  }
  return { ...profile, currentDay: profile.currentDay + 1, status: "active" };
}

export function finishCourseSession(
  state: CourseState,
  input: FinishSessionInput,
  now = new Date(),
): { state: CourseState; sessionId: string } {
  const parsed = finishSessionInputSchema.parse(input);
  if (!state.activeSession) {
    throw new Error(
      "No voice session is active. Start a session before finishing it.",
    );
  }

  const timestamp = now.toISOString();
  const next = structuredClone(state);
  const activeSession = next.activeSession;
  if (!activeSession) {
    throw new Error("The active session disappeared while preparing its log.");
  }
  const correctionIds: string[] = [];

  for (const correction of parsed.corrections) {
    const existing = next.errors.find(
      (error) =>
        !error.resolvedAt &&
        normalize(error.observed) === normalize(correction.observed) &&
        normalize(error.improved) === normalize(correction.improved),
    );
    if (existing) {
      existing.occurrences += 1;
      existing.lastSeenAt = timestamp;
      existing.category = correction.category;
      correctionIds.push(existing.id);
    } else {
      const id = randomUUID();
      next.errors.push({
        id,
        observed: correction.observed,
        improved: correction.improved,
        category: correction.category,
        occurrences: 1,
        firstSeenAt: timestamp,
        lastSeenAt: timestamp,
      });
      correctionIds.push(id);
    }
  }

  const newPhraseIds: string[] = [];
  for (const candidate of parsed.newPhrases) {
    const existing = next.phrases.find(
      (phrase) =>
        normalize(phrase.portuguese) === normalize(candidate.portuguese),
    );
    if (existing) {
      newPhraseIds.push(existing.id);
      continue;
    }
    const id = randomUUID();
    next.phrases.push({
      id,
      portuguese: candidate.portuguese,
      meaning: candidate.meaning,
      context: candidate.context,
      stage: 0,
      status: "learning",
      nextReviewAt: timestamp,
      successes: 0,
      lapses: 0,
      createdAt: timestamp,
    });
    newPhraseIds.push(id);
  }

  const completedSession: CourseState["sessions"][number] = {
    ...activeSession,
    completedAt: timestamp,
    activeMinutes: parsed.activeMinutes,
    outcome: parsed.outcome,
    wins: parsed.wins,
    correctionIds,
    newPhraseIds,
  };
  if (parsed.learnerTalkPercent !== undefined) {
    completedSession.learnerTalkPercent = parsed.learnerTalkPercent;
  }
  if (parsed.notes) {
    completedSession.notes = parsed.notes;
  }

  next.sessions.push(completedSession);
  next.profile =
    parsed.outcome === "completed"
      ? nextCoursePosition(next.profile)
      : { ...next.profile, status: "repair" };
  delete next.activeSession;
  next.updatedAt = timestamp;

  return {
    state: courseStateSchema.parse(next),
    sessionId: completedSession.id,
  };
}

export function reviewPhrase(
  state: CourseState,
  phraseId: string,
  recalled: boolean,
  now = new Date(),
): { state: CourseState; phrase: Phrase } {
  const next = structuredClone(state);
  const phrase = next.phrases.find((candidate) => candidate.id === phraseId);
  if (!phrase) {
    throw new Error(`Phrase ${phraseId} was not found.`);
  }

  if (recalled) {
    phrase.stage = Math.min(5, phrase.stage + 1);
    phrase.successes += 1;
    phrase.status = phrase.stage >= 2 ? "active" : "learning";
    if (phrase.stage === 5 && phrase.successes >= 6) {
      phrase.status = "mastered";
    }
    const interval = REVIEW_INTERVAL_DAYS[Math.max(0, phrase.stage - 1)] ?? 30;
    phrase.nextReviewAt = addDays(now, interval).toISOString();
  } else {
    phrase.stage = Math.max(0, phrase.stage - 1);
    phrase.lapses += 1;
    phrase.status = "learning";
    phrase.nextReviewAt = addDays(now, 1).toISOString();
  }
  phrase.lastReviewedAt = now.toISOString();
  next.updatedAt = now.toISOString();

  return { state: courseStateSchema.parse(next), phrase };
}
