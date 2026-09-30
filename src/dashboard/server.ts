import { readFile, stat } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  finishCourseSession,
  getCourseSnapshot,
  reviewPhrase,
  startCourseSession,
} from "../domain/course.ts";
import {
  finishSessionInputSchema,
  startSessionInputSchema,
} from "../domain/model.ts";
import { ProgressStore } from "../storage/file-store.ts";

const MAX_BODY_BYTES = 64 * 1024;
const HOST = "127.0.0.1";
const requestedPort = Number.parseInt(
  process.env.PORTUGUES_DASHBOARD_PORT ?? "4317",
  10,
);
const PORT =
  Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort < 65_536
    ? requestedPort
    : 4317;
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const staticRoot = path.resolve(currentDirectory, "dashboard");
const store = new ProgressStore();

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function securityHeaders(response: ServerResponse): void {
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
  );
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  securityHeaders(response);
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(`${JSON.stringify(payload)}\n`);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("Request body exceeds 64 KiB.");
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) {
    return {};
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    throw new Error("Request body must be valid JSON.", { cause: error });
  }
}

function isSameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (!origin) {
    return true;
  }
  return (
    origin === `http://${HOST}:${PORT}` || origin === `http://localhost:${PORT}`
  );
}

async function handleApi(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (!pathname.startsWith("/api/")) {
    return false;
  }
  if (!isSameOrigin(request)) {
    sendJson(response, 403, { error: "Cross-origin writes are not allowed." });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/status") {
    const state = await store.read();
    sendJson(response, 200, getCourseSnapshot(state));
    return true;
  }

  if (request.method === "POST" && pathname === "/api/session/start") {
    const input = startSessionInputSchema.parse(await readJson(request));
    const updated = await store.update((state) => {
      const started = startCourseSession(state, input);
      return { state: started.state, result: { created: started.created } };
    });
    sendJson(response, 200, {
      ...updated.result,
      snapshot: getCourseSnapshot(updated.state),
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/session/finish") {
    const input = finishSessionInputSchema.parse(await readJson(request));
    const updated = await store.update((state) => {
      const finished = finishCourseSession(state, input);
      return {
        state: finished.state,
        result: { sessionId: finished.sessionId },
      };
    });
    sendJson(response, 200, {
      ...updated.result,
      snapshot: getCourseSnapshot(updated.state),
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/phrases/review") {
    const input = await readJson(request);
    const parsed = typeof input === "object" && input !== null ? input : {};
    const phraseId =
      typeof Reflect.get(parsed, "phraseId") === "string"
        ? String(Reflect.get(parsed, "phraseId"))
        : "";
    const recalled = Reflect.get(parsed, "recalled");
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        phraseId,
      )
    ) {
      throw new Error("phraseId must be a valid UUID.");
    }
    if (typeof recalled !== "boolean") {
      throw new Error("recalled must be true or false.");
    }
    const updated = await store.update((state) => {
      const reviewed = reviewPhrase(state, phraseId, recalled);
      return { state: reviewed.state, result: { phrase: reviewed.phrase } };
    });
    sendJson(response, 200, {
      ...updated.result,
      snapshot: getCourseSnapshot(updated.state),
    });
    return true;
  }

  sendJson(response, 404, { error: "Unknown API route." });
  return true;
}

async function serveStatic(
  response: ServerResponse,
  pathname: string,
): Promise<void> {
  const decoded = decodeURIComponent(pathname);
  const requested = decoded === "/" ? "/index.html" : decoded;
  let filePath = path.resolve(staticRoot, `.${requested}`);
  if (
    filePath !== staticRoot &&
    !filePath.startsWith(`${staticRoot}${path.sep}`)
  ) {
    sendJson(response, 400, { error: "Invalid path." });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      throw new Error("Not a file");
    }
  } catch {
    filePath = path.join(staticRoot, "index.html");
  }

  try {
    const contents = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    securityHeaders(response);
    response.statusCode = 200;
    response.setHeader(
      "Content-Type",
      MIME_TYPES[extension] ?? "application/octet-stream",
    );
    response.setHeader(
      "Cache-Control",
      filePath.endsWith("index.html")
        ? "no-store"
        : "public, max-age=31536000, immutable",
    );
    response.end(contents);
  } catch (error) {
    sendJson(response, 503, {
      error: "Dashboard assets are unavailable. Run pnpm build first.",
      detail: error instanceof Error ? error.message : "Unknown file error",
    });
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? HOST}`,
    );
    if (await handleApi(request, response, url.pathname)) {
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }
    await serveStatic(response, url.pathname);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected dashboard error.";
    sendJson(response, 400, { error: message });
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`Português em Movimento: http://${HOST}:${PORT}\n`);
  process.stdout.write(`Progress data: ${store.filePath}\n`);
});
