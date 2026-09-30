import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import type { CourseSnapshot } from "../domain/course.ts";

type StartResponse = {
  created: boolean;
  snapshot: CourseSnapshot;
};

type MutationResponse = {
  snapshot: CourseSnapshot;
};

type ApiError = {
  error?: string;
};

const VOICE_STAGES = [
  "Recall",
  "Ear",
  "Pattern",
  "Mission",
  "Repair",
  "Replay",
  "Log",
];

function Icon({
  name,
}: {
  name: "arrow" | "check" | "copy" | "mic" | "pulse";
}) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "arrow") {
    return (
      <svg {...common}>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    );
  }
  if (name === "check") {
    return (
      <svg {...common}>
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }
  if (name === "copy") {
    return (
      <svg {...common}>
        <rect x="8" y="8" width="11" height="11" rx="2" />
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
      </svg>
    );
  }
  if (name === "mic") {
    return (
      <svg {...common}>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M3 12h4l2-6 4 12 2-6h6" />
    </svg>
  );
}

async function requestJson<Result>(
  url: string,
  init?: RequestInit,
): Promise<Result> {
  const headers = new Headers(init?.headers);
  if (init?.body) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(url, {
    ...(init ?? {}),
    headers,
  });
  const payload = (await response.json()) as Result & ApiError;
  if (!response.ok) {
    throw new Error(
      payload.error ?? `Request failed with status ${response.status}.`,
    );
  }
  return payload;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function sessionDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function weekLabel(week: number): string {
  return week === 0 ? "Calibration" : `Week ${week}`;
}

export function App() {
  const [snapshot, setSnapshot] = useState<CourseSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realNeed, setRealNeed] = useState("");
  const [copied, setCopied] = useState(false);
  const [showQuickLog, setShowQuickLog] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const next = await requestJson<CourseSnapshot>("/api/status");
      setSnapshot(next);
      setError(null);
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Unable to load course status.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    const interval = window.setInterval(() => void loadStatus(), 15_000);
    return () => window.clearInterval(interval);
  }, [loadStatus]);

  const beginSession = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = realNeed.trim()
        ? { realNeed: realNeed.trim(), availableMinutes: 75 }
        : { availableMinutes: 75 };
      const result = await requestJson<StartResponse>("/api/session/start", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSnapshot(result.snapshot);
      setRealNeed("");
      await copyPrompt(result.snapshot.voicePrompt);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Unable to start the session.",
      );
    } finally {
      setBusy(false);
    }
  };

  const copyPrompt = async (prompt = snapshot?.voicePrompt ?? "") => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      setError(
        "Clipboard access was blocked. Copy the tutor handoff from your voice conversation instead.",
      );
    }
  };

  const review = async (phraseId: string, recalled: boolean) => {
    setBusy(true);
    try {
      const result = await requestJson<MutationResponse>(
        "/api/phrases/review",
        {
          method: "POST",
          body: JSON.stringify({ phraseId, recalled }),
        },
      );
      setSnapshot(result.snapshot);
      setError(null);
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Unable to record the review.",
      );
    } finally {
      setBusy(false);
    }
  };

  const finishQuickLog = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const minutes = Number(data.get("minutes"));
    const win = String(data.get("win") ?? "").trim();
    const notes = String(data.get("notes") ?? "").trim();
    const outcome = String(data.get("outcome"));
    setBusy(true);
    try {
      const result = await requestJson<MutationResponse>(
        "/api/session/finish",
        {
          method: "POST",
          body: JSON.stringify({
            activeMinutes: minutes,
            outcome,
            wins: win ? [win] : [],
            corrections: [],
            newPhrases: [],
            ...(notes ? { notes } : {}),
          }),
        },
      );
      setSnapshot(result.snapshot);
      setShowQuickLog(false);
      setError(null);
    } catch (finishError) {
      setError(
        finishError instanceof Error
          ? finishError.message
          : "Unable to close the session.",
      );
    } finally {
      setBusy(false);
    }
  };

  const activeStage = snapshot?.activeSession ? 3 : 0;
  const weeklyTargetProgress = useMemo(() => {
    if (!snapshot) {
      return 0;
    }
    return Math.min(
      100,
      Math.round(
        (snapshot.stats.minutesThisWeek /
          snapshot.profile.weeklyTargetMinutes) *
          100,
      ),
    );
  }, [snapshot]);

  if (loading) {
    return (
      <main className="loading-screen" aria-live="polite">
        <div className="loading-mark">
          P<span>M</span>
        </div>
        <p>Loading the field console…</p>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="loading-screen error-screen">
        <p className="eyebrow">Console offline</p>
        <h1>Progress could not be loaded.</h1>
        <p>{error}</p>
        <button
          className="button primary"
          type="button"
          onClick={() => void loadStatus()}
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="masthead">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            P<span>M</span>
          </div>
          <div>
            <p className="brand-name">Português em Movimento</p>
            <p className="brand-subtitle">European Portuguese field console</p>
          </div>
        </div>
        <div className="header-status">
          <span className="live-dot" aria-hidden="true" />
          <span>Local and private</span>
          <span className="header-rule" aria-hidden="true" />
          <span>pt-PT</span>
        </div>
      </header>

      <main>
        {error ? (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        ) : null}

        <section className="mission-console" aria-labelledby="mission-title">
          <div className="mission-main">
            <div className="mission-kicker">
              <span>{weekLabel(snapshot.mission.week)}</span>
              <span>Day {snapshot.mission.day}</span>
              <span>{snapshot.activeSession ? "Session live" : "Ready"}</span>
            </div>
            <p className="eyebrow">Today’s field mission</p>
            <h1 id="mission-title">{snapshot.mission.title}</h1>
            <p className="mission-objective">{snapshot.mission.objective}.</p>

            <dl className="mission-brief">
              <div>
                <dt>Language</dt>
                <dd>{snapshot.mission.languageFocus}</dd>
              </div>
              <div>
                <dt>In your world</dt>
                <dd>{snapshot.mission.personalApplication}</dd>
              </div>
            </dl>

            {snapshot.activeSession ? (
              <div className="mission-actions active-actions">
                <button
                  className="button primary"
                  type="button"
                  onClick={() => void copyPrompt()}
                >
                  <Icon name={copied ? "check" : "copy"} />
                  {copied ? "Handoff copied" : "Copy voice handoff"}
                </button>
                <button
                  className="button quiet"
                  type="button"
                  onClick={() => setShowQuickLog((value) => !value)}
                >
                  {showQuickLog
                    ? "Close quick log"
                    : "Finish without tutor log"}
                </button>
              </div>
            ) : (
              <div className="launch-control">
                <label htmlFor="real-need">
                  Anything real you need Portuguese for today?
                </label>
                <div className="launch-row">
                  <input
                    id="real-need"
                    value={realNeed}
                    onChange={(event) => setRealNeed(event.target.value)}
                    maxLength={400}
                    placeholder="e.g. call a landlord, order at a café…"
                  />
                  <button
                    className="button primary"
                    type="button"
                    disabled={busy}
                    onClick={() => void beginSession()}
                  >
                    <Icon name="mic" />
                    {busy ? "Starting…" : "Start voice block"}
                  </button>
                </div>
                <p>
                  Starts the tracked session and copies the tutor handoff. Speak
                  in your existing Codex or ChatGPT voice chat.
                </p>
              </div>
            )}

            {showQuickLog && snapshot.activeSession ? (
              <form
                className="quick-log"
                onSubmit={(event) => void finishQuickLog(event)}
              >
                <p className="eyebrow">Fallback log</p>
                <div className="form-grid">
                  <label>
                    Minutes
                    <input
                      name="minutes"
                      type="number"
                      min="1"
                      max="240"
                      defaultValue="45"
                      required
                    />
                  </label>
                  <label>
                    Outcome
                    <select name="outcome" defaultValue="completed">
                      <option value="completed">Completed</option>
                      <option value="partial">Partial</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </label>
                </div>
                <label>
                  One evidenced win
                  <input
                    name="win"
                    maxLength={300}
                    placeholder="What could you do without a script?"
                  />
                </label>
                <label>
                  Note
                  <textarea
                    name="notes"
                    maxLength={1_000}
                    rows={2}
                    placeholder="Optional context for the next session"
                  />
                </label>
                <button
                  className="button secondary"
                  type="submit"
                  disabled={busy}
                >
                  Save & close session
                </button>
                <p className="form-note">
                  Use the tutor's full log when possible; it also captures
                  corrections and phrases.
                </p>
              </form>
            ) : null}
          </div>

          <aside className="mission-side" aria-label="Course pulse">
            <div className="pulse-heading">
              <Icon name="pulse" />
              <span>Course pulse</span>
            </div>
            <div className="primary-stat">
              <strong>{snapshot.stats.streakDays}</strong>
              <span>day streak</span>
            </div>
            <div className="stat-pair">
              <div>
                <strong>{snapshot.stats.dueCount}</strong>
                <span>reviews due</span>
              </div>
              <div>
                <strong>{snapshot.topErrors.length}</strong>
                <span>error patterns</span>
              </div>
            </div>
            <div className="weekly-meter">
              <div className="meter-label">
                <span>This week</span>
                <strong>
                  {formatMinutes(snapshot.stats.minutesThisWeek)} /{" "}
                  {formatMinutes(snapshot.profile.weeklyTargetMinutes)}
                </strong>
              </div>
              <div
                className="meter-track"
                role="progressbar"
                aria-label="Weekly practice target"
                aria-valuenow={weeklyTargetProgress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${weeklyTargetProgress}%` }} />
              </div>
            </div>
            <div className="course-position">
              <span>Route completed</span>
              <strong>{snapshot.stats.progressPercent}%</strong>
            </div>
            <p className="privacy-note">
              Stored only on this Mac. No OpenAI API key or separate inference
              bill.
            </p>
          </aside>
        </section>

        <section className="voice-loop" aria-labelledby="voice-loop-title">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">The speaking engine</p>
              <h2 id="voice-loop-title">One loop, repeated under pressure</h2>
            </div>
            <p>Administration stays outside the lesson.</p>
          </div>
          <ol>
            {VOICE_STAGES.map((stage, index) => (
              <li
                key={stage}
                className={
                  index === activeStage
                    ? "current"
                    : index < activeStage
                      ? "passed"
                      : ""
                }
              >
                <span className="stage-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong>{stage}</strong>
              </li>
            ))}
          </ol>
        </section>

        <div className="workbench">
          <section className="route-panel" aria-labelledby="route-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">12-week route</p>
                <h2 id="route-title">From calibration to Portuguese-first</h2>
              </div>
              <span className="route-count">
                {snapshot.stats.sessionsCompleted} sessions ·{" "}
                {formatMinutes(snapshot.stats.totalMinutes)}
              </span>
            </div>
            <div className="route-track" role="list" aria-label="Course weeks">
              {snapshot.route.map((week) => {
                const complete = week.week < snapshot.profile.currentWeek;
                const current = week.week === snapshot.profile.currentWeek;
                return (
                  <div
                    className={`route-stop${complete ? " complete" : ""}${current ? " current" : ""}`}
                    key={week.week}
                    role="listitem"
                  >
                    <span className="route-node">
                      {complete ? <Icon name="check" /> : week.week}
                    </span>
                    <div>
                      <span>
                        {week.week === 0
                          ? "BASE"
                          : `WK ${String(week.week).padStart(2, "0")}`}
                      </span>
                      <strong>{week.title}</strong>
                      {current ? <p>{week.mission}</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="review-panel" aria-labelledby="review-title">
            <div className="section-heading tight">
              <div>
                <p className="eyebrow">Memory queue</p>
                <h2 id="review-title">Due now</h2>
              </div>
              <span className="count-badge">{snapshot.duePhrases.length}</span>
            </div>
            {snapshot.duePhrases.length ? (
              <ul className="phrase-list">
                {snapshot.duePhrases.slice(0, 5).map((phrase) => (
                  <li key={phrase.id}>
                    <div>
                      <strong lang="pt-PT">{phrase.portuguese}</strong>
                      <span>{phrase.meaning}</span>
                    </div>
                    <div
                      className="review-actions"
                      aria-label={`Review ${phrase.portuguese}`}
                    >
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void review(phrase.id, false)}
                        aria-label="Not recalled"
                      >
                        ×
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void review(phrase.id, true)}
                        aria-label="Recalled"
                      >
                        <Icon name="check" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <span>00</span>
                <p>
                  No phrases are due yet. The first useful phrases will appear
                  after your baseline.
                </p>
              </div>
            )}

            <div className="error-ledger">
              <div className="ledger-heading">
                <span>Recurring errors</span>
                <span>frequency</span>
              </div>
              {snapshot.topErrors.length ? (
                snapshot.topErrors.slice(0, 3).map((pattern) => (
                  <div className="error-row" key={pattern.id}>
                    <div>
                      <s>{pattern.observed}</s>
                      <strong>{pattern.improved}</strong>
                    </div>
                    <span>{String(pattern.occurrences).padStart(2, "0")}</span>
                  </div>
                ))
              ) : (
                <p className="empty-ledger">
                  No repeated pattern has earned priority yet.
                </p>
              )}
            </div>
          </aside>
        </div>

        <section className="session-log" aria-labelledby="session-log-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Field record</p>
              <h2 id="session-log-title">Recent sessions</h2>
            </div>
          </div>
          {snapshot.recentSessions.length ? (
            <div className="session-table" role="table">
              {snapshot.recentSessions.map((session) => (
                <div className="session-row" role="row" key={session.id}>
                  <span role="cell">{sessionDate(session.completedAt)}</span>
                  <strong role="cell">{session.missionTitle}</strong>
                  <span role="cell">
                    {formatMinutes(session.activeMinutes)}
                  </span>
                  <span className={`outcome ${session.outcome}`} role="cell">
                    {session.outcome}
                  </span>
                  <span role="cell">
                    {session.wins[0] ?? "Logged without a written win"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="first-record">
              Your baseline will become the first field record.
            </p>
          )}
        </section>
      </main>

      <footer>
        <span>Voice first. Writing second. Real life always.</span>
        <span>Revision {snapshot.revision}</span>
      </footer>
    </div>
  );
}
