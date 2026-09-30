import { z } from "zod";

const text = (maximum: number) => z.string().trim().min(1).max(maximum);

export const courseStatusSchema = z.enum([
  "baseline",
  "active",
  "repair",
  "completed",
]);

export const sessionOutcomeSchema = z.enum(["completed", "partial", "blocked"]);

export const correctionCategorySchema = z.enum([
  "comprehensibility",
  "grammar",
  "pronunciation",
  "vocabulary",
  "register",
  "listening",
]);

export const correctionInputSchema = z.object({
  observed: text(240),
  improved: text(240),
  category: correctionCategorySchema,
});

export const phraseInputSchema = z.object({
  portuguese: text(240),
  meaning: text(300),
  context: text(400),
});

export const finishSessionInputSchema = z.object({
  activeMinutes: z.number().int().min(1).max(240),
  outcome: sessionOutcomeSchema,
  wins: z.array(text(300)).max(5).default([]),
  corrections: z.array(correctionInputSchema).max(3).default([]),
  newPhrases: z.array(phraseInputSchema).max(8).default([]),
  learnerTalkPercent: z.number().int().min(0).max(100).optional(),
  notes: z.string().trim().max(1_000).optional(),
});

export const startSessionInputSchema = z.object({
  realNeed: z.string().trim().max(400).optional(),
  availableMinutes: z.number().int().min(15).max(180).default(75),
});

export const learnerSettingsSchema = z.object({
  learnerName: text(80).default("Learner"),
  explanationLanguage: text(80).default("English"),
  interests: z.array(text(120)).max(12).default([]),
});

export const profileSchema = learnerSettingsSchema.extend({
  targetVariant: z.literal("pt-PT"),
  targetWeeks: z.literal(12),
  weeklyTargetMinutes: z.number().int().min(45).max(1_800),
  currentWeek: z.number().int().min(0).max(12),
  currentDay: z.number().int().min(0).max(7),
  status: courseStatusSchema,
  startedAt: z.string().datetime(),
});

export const activeSessionSchema = z.object({
  id: z.string().uuid(),
  startedAt: z.string().datetime(),
  week: z.number().int().min(0).max(12),
  day: z.number().int().min(0).max(7),
  missionId: text(120),
  missionTitle: text(240),
  objective: text(600),
  availableMinutes: z.number().int().min(15).max(180),
  realNeed: z.string().trim().max(400).optional(),
});

export const completedSessionSchema = activeSessionSchema.extend({
  completedAt: z.string().datetime(),
  activeMinutes: z.number().int().min(1).max(240),
  outcome: sessionOutcomeSchema,
  wins: z.array(text(300)).max(5),
  correctionIds: z.array(z.string().uuid()).max(3),
  newPhraseIds: z.array(z.string().uuid()).max(8),
  learnerTalkPercent: z.number().int().min(0).max(100).optional(),
  notes: z.string().trim().max(1_000).optional(),
});

export const phraseSchema = z.object({
  id: z.string().uuid(),
  portuguese: text(240),
  meaning: text(300),
  context: text(400),
  stage: z.number().int().min(0).max(5),
  status: z.enum(["learning", "active", "mastered"]),
  nextReviewAt: z.string().datetime(),
  successes: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  lastReviewedAt: z.string().datetime().optional(),
});

export const recurringErrorSchema = z.object({
  id: z.string().uuid(),
  observed: text(240),
  improved: text(240),
  category: correctionCategorySchema,
  occurrences: z.number().int().positive(),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
});

export const courseStateSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
  profile: profileSchema,
  activeSession: activeSessionSchema.optional(),
  sessions: z.array(completedSessionSchema).max(1_000),
  phrases: z.array(phraseSchema).max(2_000),
  errors: z.array(recurringErrorSchema).max(1_000),
});

export type ActiveSession = z.infer<typeof activeSessionSchema>;
export type CompletedSession = z.infer<typeof completedSessionSchema>;
export type CorrectionInput = z.infer<typeof correctionInputSchema>;
export type CourseState = z.infer<typeof courseStateSchema>;
export type FinishSessionInput = z.infer<typeof finishSessionInputSchema>;
export type Phrase = z.infer<typeof phraseSchema>;
export type PhraseInput = z.infer<typeof phraseInputSchema>;
export type RecurringError = z.infer<typeof recurringErrorSchema>;
export type StartSessionInput = z.infer<typeof startSessionInputSchema>;
