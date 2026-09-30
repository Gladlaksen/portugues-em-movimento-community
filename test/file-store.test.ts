import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { ProgressStore } from "../src/storage/file-store.ts";

test("progress writes are serialized and revisions remain monotonic", async () => {
  const dataDirectory = await mkdtemp(
    path.join(tmpdir(), "portugues-em-movimento-test-"),
  );
  try {
    const store = new ProgressStore(dataDirectory);
    const updates = await Promise.all([
      store.update((state) => ({ state, result: "first" })),
      store.update((state) => ({ state, result: "second" })),
    ]);
    const state = await store.read();

    assert.deepEqual(
      new Set(updates.map((update) => update.result)),
      new Set(["first", "second"]),
    );
    assert.equal(state.revision, 2);
  } finally {
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
