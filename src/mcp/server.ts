import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  finishCourseSession,
  getCourseSnapshot,
  reviewPhrase,
  startCourseSession,
} from "../domain/course.ts";
import {
  learnerSettingsSchema,
  finishSessionInputSchema,
  startSessionInputSchema,
} from "../domain/model.ts";
import { ProgressStore } from "../storage/file-store.ts";

const server = new McpServer({
  name: "portugues-em-movimento",
  version: "0.2.0",
});
const store = new ProgressStore();

function toolResult(payload: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(payload, null, 2) },
    ],
  };
}

function compactSnapshot(snapshot: ReturnType<typeof getCourseSnapshot>) {
  return {
    revision: snapshot.revision,
    profile: snapshot.profile,
    course: {
      week: snapshot.profile.currentWeek,
      day: snapshot.profile.currentDay,
      status: snapshot.profile.status,
      targetVariant: snapshot.profile.targetVariant,
    },
    mission: snapshot.mission,
    activeSession: snapshot.activeSession ?? null,
    duePhrases: snapshot.duePhrases.slice(0, 12).map((phrase) => ({
      id: phrase.id,
      portuguese: phrase.portuguese,
      meaning: phrase.meaning,
      context: phrase.context,
      stage: phrase.stage,
    })),
    topErrors: snapshot.topErrors.slice(0, 6).map((error) => ({
      id: error.id,
      observed: error.observed,
      improved: error.improved,
      category: error.category,
      occurrences: error.occurrences,
    })),
    stats: snapshot.stats,
    voicePrompt: snapshot.voicePrompt,
  };
}

server.registerTool(
  "portugues_get_status",
  {
    title: "Get Portuguese course status",
    description:
      "Read the current course position, today's mission, due phrase reviews, recurring errors and progress metrics. Does not start a session.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => {
    const state = await store.read();
    return toolResult(compactSnapshot(getCourseSnapshot(state)));
  },
);

server.registerTool(
  "portugues_start_session",
  {
    title: "Start Portuguese voice session",
    description:
      "Create today's active voice session and return a contextual pt-PT tutor prompt. Reuses the active session if one already exists.",
    inputSchema: startSessionInputSchema.shape,
    annotations: { readOnlyHint: false, idempotentHint: true },
  },
  async (input) => {
    const updated = await store.update((state) => {
      const started = startCourseSession(state, input);
      return { state: started.state, result: { created: started.created } };
    });
    const snapshot = getCourseSnapshot(updated.state);
    return toolResult({ ...updated.result, ...compactSnapshot(snapshot) });
  },
);

server.registerTool(
  "portugues_finish_session",
  {
    title: "Finish Portuguese voice session",
    description:
      "Save the active lesson before saying goodbye whenever useful practice ends, including partial lessons, without a separate save request. Persist evidenced wins, up to three corrections and up to eight useful phrases. In realtime voice, delegate this tool call to the backend. Confirm progress saved only after this tool succeeds.",
    inputSchema: finishSessionInputSchema.shape,
    annotations: { readOnlyHint: false, idempotentHint: false },
  },
  async (input) => {
    const updated = await store.update((state) => {
      const finished = finishCourseSession(state, input);
      return {
        state: finished.state,
        result: { sessionId: finished.sessionId },
      };
    });
    return toolResult({
      ...updated.result,
      status: compactSnapshot(getCourseSnapshot(updated.state)),
    });
  },
);

server.registerTool(
  "portugues_review_phrase",
  {
    title: "Record Portuguese phrase review",
    description:
      "Record whether one explicitly tested phrase was retrieved without reading and schedule its next review.",
    inputSchema: {
      phraseId: z.string().uuid(),
      recalled: z.boolean(),
    },
    annotations: { readOnlyHint: false, idempotentHint: false },
  },
  async ({ phraseId, recalled }) => {
    const updated = await store.update((state) => {
      const reviewed = reviewPhrase(state, phraseId, recalled);
      return { state: reviewed.state, result: { phrase: reviewed.phrase } };
    });
    return toolResult({
      ...updated.result,
      dueCount: getCourseSnapshot(updated.state).stats.dueCount,
    });
  },
);

server.registerTool(
  "portugues_get_voice_prompt",
  {
    title: "Get today's Portuguese voice prompt",
    description:
      "Read a compact voice-tutor handoff built from today's mission, due phrases and current error priorities.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => {
    const state = await store.read();
    const snapshot = getCourseSnapshot(state);
    return toolResult({
      activeSessionId: snapshot.activeSession?.id ?? null,
      voicePrompt: snapshot.voicePrompt,
    });
  },
);

server.registerTool(
  "portugues_configure_learner",
  {
    title: "Configure Portuguese learner",
    description:
      "Set the learner name, brief-explanation language and interests without resetting progress. Pass all three settings.",
    inputSchema: learnerSettingsSchema.required().shape,
    annotations: { readOnlyHint: false, idempotentHint: true },
  },
  async (input) => {
    const settings = learnerSettingsSchema.parse(input);
    const updated = await store.update((state) => ({
      state: {
        ...state,
        profile: { ...state.profile, ...settings },
        updatedAt: new Date().toISOString(),
      },
      result: {},
    }));
    return toolResult({ profile: updated.state.profile });
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
