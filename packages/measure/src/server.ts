import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
};

const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg", ".txt", ".xml", ".webmanifest"]);

export interface StaticServer {
  /** e.g. "http://127.0.0.1:49321" */
  url: string;
  close(): Promise<void>;
}

/**
 * Serves a static build directory the way a production host would: gzip for
 * text types, long-lived Cache-Control on subresources (so warm-cache passes
 * are meaningful), no-cache on HTML documents.
 */
export async function serveStatic(dir: string): Promise<StaticServer> {
  const root = resolve(dir);
  const rootStat = await stat(root).catch(() => null);
  if (!rootStat?.isDirectory()) {
    throw new Error(`Not a directory: ${root}`);
  }

  const server: Server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
      const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
      let filePath = join(root, safePath);
      if (!filePath.startsWith(root + sep) && filePath !== root) {
        res.writeHead(403).end();
        return;
      }
      let fileStat = await stat(filePath).catch(() => null);
      if (fileStat?.isDirectory()) {
        filePath = join(filePath, "index.html");
        fileStat = await stat(filePath).catch(() => null);
      }
      if (!fileStat?.isFile()) {
        res.writeHead(404, { "content-type": "text/plain" }).end("not found");
        return;
      }

      const ext = extname(filePath).toLowerCase();
      const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
      const isHtml = ext === ".html";
      res.setHeader("content-type", contentType);
      res.setHeader(
        "cache-control",
        isHtml ? "no-cache" : "public, max-age=31536000, immutable",
      );

      const acceptsGzip = /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""));
      if (acceptsGzip && COMPRESSIBLE.has(ext)) {
        const body = gzipSync(await readFile(filePath));
        res.setHeader("content-encoding", "gzip");
        res.setHeader("content-length", body.byteLength);
        res.end(body);
      } else {
        res.setHeader("content-length", fileStat.size);
        createReadStream(filePath).pipe(res);
      }
    } catch (err) {
      res.writeHead(500, { "content-type": "text/plain" }).end(String(err));
    }
  });

  await new Promise<void>((resolvePromise) => {
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("failed to bind static server");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolvePromise, rejectPromise) => {
        server.close((err) => (err ? rejectPromise(err) : resolvePromise()));
      }),
  };
}
