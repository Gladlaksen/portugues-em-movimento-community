import {
  mkdir,
  open,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { createInitialState } from "../domain/course.ts";
import { courseStateSchema, type CourseState } from "../domain/model.ts";

const LOCK_RETRY_MS = 25;
const LOCK_ATTEMPTS = 80;
const STALE_LOCK_MS = 15_000;

type UpdateResult<Result> = {
  state: CourseState;
  result: Result;
};

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function resolveDataDirectory(): string {
  const configured = process.env.PORTUGUES_DATA_DIR?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(homedir(), ".portugues-em-movimento-community");
}

export class ProgressStore {
  readonly dataDirectory: string;
  readonly filePath: string;
  readonly lockPath: string;

  constructor(dataDirectory = resolveDataDirectory()) {
    this.dataDirectory = path.resolve(dataDirectory);
    this.filePath = path.join(this.dataDirectory, "progress.json");
    this.lockPath = path.join(this.dataDirectory, "progress.lock");
  }

  async read(): Promise<CourseState> {
    await mkdir(this.dataDirectory, { recursive: true, mode: 0o700 });
    try {
      const raw = await readFile(this.filePath, "utf8");
      return courseStateSchema.parse(JSON.parse(raw));
    } catch (error) {
      if (!isNodeError(error, "ENOENT")) {
        throw new Error(
          `Unable to read Portuguese course progress at ${this.filePath}.`,
          {
            cause: error,
          },
        );
      }
      const initial = createInitialState();
      await this.writeAtomic(initial);
      return initial;
    }
  }

  async update<Result>(
    transform: (
      state: CourseState,
    ) => Promise<UpdateResult<Result>> | UpdateResult<Result>,
  ): Promise<UpdateResult<Result>> {
    const lock = await this.acquireLock();
    try {
      const current = await this.read();
      const updated = await transform(structuredClone(current));
      const state = courseStateSchema.parse({
        ...updated.state,
        revision: current.revision + 1,
      });
      await this.writeAtomic(state);
      return { state, result: updated.result };
    } finally {
      await lock.close();
      await unlink(this.lockPath).catch((error: unknown) => {
        if (!isNodeError(error, "ENOENT")) {
          throw error;
        }
      });
    }
  }

  private async acquireLock(): Promise<Awaited<ReturnType<typeof open>>> {
    await mkdir(this.dataDirectory, { recursive: true, mode: 0o700 });
    for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt += 1) {
      try {
        return await open(this.lockPath, "wx", 0o600);
      } catch (error) {
        if (!isNodeError(error, "EEXIST")) {
          throw new Error(
            `Unable to lock Portuguese course progress at ${this.lockPath}.`,
            {
              cause: error,
            },
          );
        }

        try {
          const lockStat = await stat(this.lockPath);
          if (Date.now() - lockStat.mtimeMs > STALE_LOCK_MS) {
            await unlink(this.lockPath);
            continue;
          }
        } catch (statError) {
          if (!isNodeError(statError, "ENOENT")) {
            throw statError;
          }
        }
        await wait(LOCK_RETRY_MS);
      }
    }
    throw new Error(
      "Portuguese course progress is busy. Try again in a moment.",
    );
  }

  private async writeAtomic(state: CourseState): Promise<void> {
    const validated = courseStateSchema.parse(state);
    await mkdir(this.dataDirectory, { recursive: true, mode: 0o700 });
    const temporaryPath = path.join(
      this.dataDirectory,
      `progress.${process.pid}.${Date.now()}.tmp`,
    );
    try {
      await writeFile(
        temporaryPath,
        `${JSON.stringify(validated, null, 2)}\n`,
        {
          encoding: "utf8",
          flag: "wx",
          mode: 0o600,
        },
      );
      await rename(temporaryPath, this.filePath);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw new Error(
        `Unable to save Portuguese course progress at ${this.filePath}.`,
        {
          cause: error,
        },
      );
    }
  }
}
