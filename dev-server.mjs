import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(".");
const readCliValue = (name, fallback) => {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
};
const host = readCliValue("host", process.env.HOST || "127.0.0.1");
const port = Number(readCliValue("port", process.env.PORT || "4174"));

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

const resolveRequestPath = (url = "/") => {
  const pathname = decodeURIComponent(new URL(url, `http://${host}:${port}`).pathname);
  const cleanPath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const requestedPath = resolve(join(root, cleanPath));
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (requestedPath !== root && !requestedPath.startsWith(rootPrefix)) {
    return null;
  }
  if (existsSync(requestedPath) && statSync(requestedPath).isFile()) {
    return requestedPath;
  }
  return join(root, "index.html");
};

const server = createServer((request, response) => {
  const filePath = resolveRequestPath(request.url);
  if (!filePath || !existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, host, () => {
  console.log(`ONLYPUMP preview server running at http://${host}:${port}/index.html`);
});

server.on("error", (error) => {
  console.error(`ONLYPUMP preview server failed on http://${host}:${port}/index.html`);
  console.error(error);
  process.exit(1);
});
