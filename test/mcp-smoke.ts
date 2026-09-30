import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const dataDirectory = await mkdtemp(
  path.join(tmpdir(), "portugues-mcp-smoke-"),
);
const client = new Client({
  name: "portugues-em-movimento-smoke",
  version: "0.1.0",
});
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.resolve("dist/mcp-server.js")],
  env: {
    PATH: process.env.PATH ?? "",
    PORTUGUES_DATA_DIR: dataDirectory,
  },
});

try {
  await client.connect(transport);
  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name);
  assert.deepEqual(
    names.sort(),
    [
      "portugues_configure_learner",
      "portugues_finish_session",
      "portugues_get_status",
      "portugues_get_voice_prompt",
      "portugues_review_phrase",
      "portugues_start_session",
    ].sort(),
  );

  const configured = await client.callTool({
    name: "portugues_configure_learner",
    arguments: {
      learnerName: "Test learner",
      explanationLanguage: "Spanish",
      interests: ["music"],
    },
  });
  assert.equal(configured.isError, undefined);
  const initial = JSON.parse(
    await readFile(path.join(dataDirectory, "progress.json"), "utf8"),
  );
  assert.deepEqual(initial.sessions, []);
  assert.deepEqual(initial.phrases, []);
  assert.deepEqual(initial.errors, []);
  assert.equal(initial.profile.currentWeek, 0);
  assert.equal(initial.profile.explanationLanguage, "Spanish");

  const started = await client.callTool({
    name: "portugues_start_session",
    arguments: {
      realNeed: "introduce myself in Portugal",
      availableMinutes: 45,
    },
  });
  assert.equal(started.isError, undefined);
  assert.equal(Array.isArray(started.content), true);

  const status = await client.callTool({
    name: "portugues_get_status",
    arguments: {},
  });
  assert.equal(status.isError, undefined);
  assert.ok(Array.isArray(status.content));
  const text = status.content.find(
    (item): item is { type: "text"; text: string } =>
      typeof item === "object" &&
      item !== null &&
      Reflect.get(item, "type") === "text" &&
      typeof Reflect.get(item, "text") === "string",
  );
  assert.ok(text);
  assert.match(text.text, /introduce myself in Portugal/u);
  assert.match(text.text, /Spanish/u);
  assert.match(text.text, /music/u);

  const finished = await client.callTool({
    name: "portugues_finish_session",
    arguments: {
      activeMinutes: 15,
      outcome: "partial",
      wins: ["Practised a coffee order with support"],
      newPhrases: [
        {
          portuguese: "Queria um café, por favor.",
          meaning: "I'd like a coffee, please.",
          context: "Ordering at a café",
        },
      ],
    },
  });
  assert.equal(finished.isError, undefined);

  const persisted = JSON.parse(
    await readFile(path.join(dataDirectory, "progress.json"), "utf8"),
  );
  assert.equal(persisted.activeSession, undefined);
  assert.equal(persisted.sessions.length, 1);
  assert.equal(persisted.sessions[0].activeMinutes, 15);
  assert.equal(persisted.sessions[0].outcome, "partial");
  assert.equal(persisted.profile.currentWeek, 0);
  assert.equal(persisted.phrases[0].portuguese, "Queria um café, por favor.");

  const repeatedFinish = await client.callTool({
    name: "portugues_finish_session",
    arguments: { activeMinutes: 15, outcome: "partial" },
  });
  assert.equal(repeatedFinish.isError, true);
  assert.equal(
    await readFile(path.join(dataDirectory, "progress.json"), "utf8"),
    JSON.stringify(persisted, null, 2) + "\n",
  );

  const invalidSettings = await client.callTool({
    name: "portugues_configure_learner",
    arguments: {
      learnerName: "",
      explanationLanguage: "English",
      interests: [],
    },
  });
  assert.equal(invalidSettings.isError, true);
  assert.equal(
    await readFile(path.join(dataDirectory, "progress.json"), "utf8"),
    JSON.stringify(persisted, null, 2) + "\n",
  );
  const reconfigured = await client.callTool({
    name: "portugues_configure_learner",
    arguments: {
      learnerName: "Another test name",
      explanationLanguage: "French",
      interests: ["cooking"],
    },
  });
  assert.equal(reconfigured.isError, undefined);
  const retained = JSON.parse(
    await readFile(path.join(dataDirectory, "progress.json"), "utf8"),
  );
  assert.deepEqual(retained.sessions, persisted.sessions);
  assert.deepEqual(retained.phrases, persisted.phrases);
  assert.deepEqual(retained.errors, persisted.errors);
  assert.equal(retained.profile.currentWeek, persisted.profile.currentWeek);
  assert.equal(retained.profile.explanationLanguage, "French");

  process.stdout.write(`MCP smoke passed (${names.length} tools).\n`);
} finally {
  await client.close().catch(() => undefined);
  await rm(dataDirectory, { recursive: true, force: true });
}
