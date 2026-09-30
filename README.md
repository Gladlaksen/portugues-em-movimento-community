# Português em Movimento

A reusable, voice-first European Portuguese (`pt-PT`) course and local Codex plugin: 12 weeks of missions, adaptive phrase review, focused corrections, session continuity and a progress dashboard. The learner's name, explanation language and interests are configurable. No API key is needed; speaking practice runs in your existing Codex voice conversation.

## Install in Codex

Requires Node.js 22 or newer on your PATH and a Codex version supporting plugins. Built services and dashboard assets are included, so installation does not require pnpm. Download or clone this repository, then from its root run:

```sh
codex plugin marketplace add "$PWD"
codex plugin add portugues-em-movimento@portugues-em-movimento-community
```

These commands follow the [official marketplace documentation](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli) and the installed CLI help.

Enable the plugin in Codex and start a fresh chat. If another edition of this plugin is enabled, disable that edition in this chat so the tutor uses the intended tools. Your existing records are not migrated.

Say: “Set up my Portuguese course. My name is Lucas, use English for brief explanations, and my interests are music and travel.” Replace those example preferences with your own. The tutor calls `portugues_configure_learner`; it can update those settings later without clearing progress. Then say: “Start today's European Portuguese voice session.”

First use creates an empty baseline, with no sessions, phrases or errors. The tutor uses Recall → Ear → Pattern → Mission → Repair → Replay → Log, asks one question at a time, and saves only evidenced practice before closing a substantive lesson. A disconnect can leave a session active; resume it rather than inventing a saved log.

If plugin installation is unavailable, a compatible MCP client can launch `node` with the absolute path to `dist/mcp-server.js`, and the tutor instructions can be supplied from `skills/portugues-em-movimento/SKILL.md`. Configure both the MCP server and dashboard with the same data directory.

## Dashboard and private storage

From the repository root:

```sh
node dist/dashboard-server.js
```

Open http://127.0.0.1:4317. The dashboard binds only to loopback. Its quick log supports manual save after practice in a separate ChatGPT voice conversation; that separate app cannot automatically write to this local plugin.

By default all learner settings and records are stored in `~/.portugues-em-movimento-community/progress.json`, outside the repository. This is intentionally separate from the original edition's data directory. `PORTUGUES_DATA_DIR` overrides the directory; set it consistently for both services. Use a new empty directory for each additional learner. Configuration updates never reset progress. `PORTUGUES_DASHBOARD_PORT` changes the dashboard port.

Do not point this edition at someone else's data directory. Do not put learner records into Git. The blank manual log is a template: copy it into your private data directory before filling it out.

## Curriculum

- [Tutor skill](skills/portugues-em-movimento/SKILL.md): current teaching and saving workflow.
- [12-week route](skills/portugues-em-movimento/references/COURSE_ROUTE.md).
- [First 14 days](skills/portugues-em-movimento/references/FIRST_14_DAYS.md).
- [Tutor protocol](skills/portugues-em-movimento/references/TUTOR_PROTOCOL.md).
- [Full course manual](course/portugisisk-intensivkurs/README.md): Norwegian reference text, daily generator and blank manual log; independent of the configured explanation language.
- [Course book PDF](course/portugisisk-intensivkurs.pdf): regenerated from sanitized course text.

The intensive schedule is optional. Adjust session duration to your time budget. The A2+/early-B1 target is a planning goal, not a promised outcome. Use human pt-PT feedback to calibrate pronunciation and naturalness.

## Development

```sh
pnpm install --frozen-lockfile
pnpm verify
pnpm format:check
```

Tests use temporary data directories. `pnpm verify` checks types, unit tests, builds both services and the dashboard, and exercises the MCP session lifecycle. Rebuild and commit `dist/` whenever source changes. To regenerate the Norwegian PDF on macOS, install Python's `reportlab` package and run `python3 scripts/build_portuguese_course_pdf.py` (the existing renderer uses system Arial fonts).

## Sharing boundary

This edition has fresh Git history. It includes source, built assets, tests and reusable teaching materials. It excludes personal progress snapshots, completed lessons, conversation exports, deployment details, SSH relay settings and the original Git history. The original personalized PDF is excluded; the included PDF is rebuilt from this edition's text.

License status remains UNLICENSED; this copy does not introduce a new open-source license.
