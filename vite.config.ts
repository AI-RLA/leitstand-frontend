import {
  defineConfig,
  type Connect,
  type Plugin,
  type ProxyOptions,
} from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import pkg from "./package.json";

// The dev server attaches the backend's bearer upstream, as nginx does in Docker.
const TOKEN_FILE =
  process.env.LEITSTAND_AUTH_TOKEN_FILE ??
  path.resolve(
    __dirname,
    "../leitstand-backend/secrets/leitstand_auth_bearer_token",
  );

function readToken(): string {
  try {
    const token = fs.readFileSync(TOKEN_FILE, "utf8").trim();
    console.info(
      `[proxy] bearer ${token ? "attached from" : "file empty at"} ${TOKEN_FILE}`,
    );
    return token;
  } catch {
    // Read once at config load; a token-gated backend then answers 401 to every call, so log it.
    console.info(
      `[proxy] no readable token at ${TOKEN_FILE}; proxying without Authorization`,
    );
    return "";
  }
}

function withBearer(target: string, ws = false): ProxyOptions {
  const token = readToken();
  return {
    target,
    ws,
    changeOrigin: true,
    configure(proxy) {
      if (!token) return;
      const attach = (req: { setHeader(name: string, value: string): void }) =>
        req.setHeader("Authorization", `Bearer ${token}`);
      proxy.on("proxyReq", attach);
      // A plain `headers` option does not reach the upgrade request.
      proxy.on("proxyReqWs", attach);
    },
  };
}

// Read per request so edits to the local map config show on reload without restarting the server.
function mapConfigFile(): Plugin {
  const file = process.env.LEITSTAND_MAP_CONFIG_FILE;
  const serve = (server: { middlewares: Connect.Server }) => {
    if (!file) return;
    const resolved = path.resolve(process.cwd(), file);
    console.info(`[map config] serving ${resolved} at /config/map.json`);
    server.middlewares.use("/config/map.json", (_req, res) => {
      try {
        const body = fs.readFileSync(resolved, "utf8");
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-cache");
        res.end(body);
      } catch (err) {
        res.statusCode = 500;
        res.end(`cannot read ${resolved}: ${String(err)}`);
      }
    });
  };
  return {
    name: "leitstand-map-config-file",
    configureServer: serve,
    configurePreviewServer: serve,
  };
}

export default defineConfig({
  plugins: [react(), mapConfigFile()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": withBearer("http://127.0.0.1:8080"),
      "/ws": withBearer("ws://127.0.0.1:8080", true),
    },
  },
});
