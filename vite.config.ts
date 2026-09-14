import { defineConfig, type ProxyOptions } from "vite";
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

export default defineConfig({
  plugins: [react()],
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
