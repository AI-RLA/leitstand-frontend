import type { Battery, Pose, RobotStateData } from "@/api/client";
import { useFleet } from "@/stores/fleet";

const WS_URL = import.meta.env.VITE_WS_URL ?? "/ws/v1";
const LIVENESS_INTERVAL_MS = 5_000;
const LIVENESS_TIMEOUT_MS = 10_000;

type Frame =
  | { type: "hello"; version: string }
  | { type: "event"; topic: string; payload: unknown }
  | { type: "ping" }
  | { type: "pong" }
  | { type: "error"; message: string };

export type WsHandle = {
  close: () => void;
  subscribe: (topic: string) => void;
  unsubscribe: (topic: string) => void;
};

function resolveUrl(): string {
  if (WS_URL.startsWith("ws")) return WS_URL;
  const scheme = location.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${location.host}${WS_URL}`;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isPose(p: unknown): p is Pose {
  if (typeof p !== "object" || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    isFiniteNumber(o.lat) &&
    isFiniteNumber(o.lon) &&
    (o.heading_deg === null ||
      o.heading_deg === undefined ||
      isFiniteNumber(o.heading_deg)) &&
    (o.horizontal_accuracy_m === null ||
      o.horizontal_accuracy_m === undefined ||
      isFiniteNumber(o.horizontal_accuracy_m)) &&
    typeof o.ts === "string" &&
    o.frame === "wgs84"
  );
}

function isBattery(p: unknown): p is Battery {
  if (typeof p !== "object" || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    isFiniteNumber(o.battery_pct) &&
    typeof o.charging === "boolean" &&
    typeof o.ts === "string"
  );
}

function isRobotState(p: unknown): p is RobotStateData {
  if (typeof p !== "object" || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.status === "string" &&
    ["active", "idle", "charging", "alert"].includes(o.status) &&
    typeof o.task === "string" &&
    typeof o.ts === "string"
  );
}

export function connectWs(): WsHandle {
  let ws: WebSocket | null = null;
  let reconnectAfter = 500;
  let stopped = false;
  let lastPing = Date.now();
  let attempts = 0;
  const topics = new Set<string>(["events.registry", "events.robot"]);

  function send(frame: object): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(frame));
    }
  }

  function connect(): void {
    attempts += 1;
    console.info(`[ws] connecting… (attempt ${attempts})`);
    ws = new WebSocket(resolveUrl());

    ws.addEventListener("open", () => {
      reconnectAfter = 500;
      lastPing = Date.now();
      useFleet.getState().setWsConnected(true);
      for (const topic of topics) {
        ws!.send(JSON.stringify({ type: "subscribe", topic }));
      }
    });

    ws.addEventListener("message", (ev) => {
      let f: Frame;
      try {
        f = JSON.parse(ev.data as string) as Frame;
      } catch (err) {
        console.warn("[ws] malformed frame:", err);
        return;
      }
      if (f.type === "hello") {
        useFleet.getState().setBackendVersion(f.version);
        console.info(
          `[ws] connected — backend v${f.version} (attempt ${attempts})`,
        );
        attempts = 0;
        return;
      }
      if (f.type === "ping") {
        lastPing = Date.now();
        ws!.send(JSON.stringify({ type: "pong" }));
        return;
      }
      if (f.type === "error") {
        console.error("[ws] server error:", f.message);
        return;
      }
      if (f.type !== "event") return; // drops pong (client never pings)
      const fleet = useFleet.getState();
      if (f.topic === "events.registry") {
        const p = f.payload as { type?: string; robot_id?: string };
        if (typeof p?.robot_id !== "string") return;
        if (p.type === "robot.online") fleet.setOnline(p.robot_id, true);
        else if (p.type === "robot.offline") fleet.setOnline(p.robot_id, false);
      } else if (f.topic.startsWith("events.robot/")) {
        const segs = f.topic.split("/");
        const id = segs[1];
        const kind = segs[2];
        if (!id || !kind) return;
        if (kind === "pose" && isPose(f.payload)) fleet.setPose(id, f.payload);
        else if (kind === "battery" && isBattery(f.payload))
          fleet.setBattery(id, f.payload);
        else if (kind === "state" && isRobotState(f.payload))
          fleet.setState(id, f.payload);
      }
    });

    ws.addEventListener("close", () => {
      useFleet.getState().setWsConnected(false);
      useFleet.getState().setBackendVersion(null);
      if (stopped) {
        console.info("[ws] closed");
        return;
      }
      console.info(`[ws] disconnected — reconnecting in ${reconnectAfter}ms`);
      setTimeout(connect, reconnectAfter);
      reconnectAfter = Math.min(reconnectAfter * 2, 10_000);
    });
  }

  // Liveness watchdog: server pings every ~3s. If we miss >10s, force-close
  // so the close handler triggers reconnect — covers a half-open socket
  // where TCP keepalive would otherwise take minutes.
  const liveness = window.setInterval(() => {
    if (
      Date.now() - lastPing > LIVENESS_TIMEOUT_MS &&
      ws &&
      ws.readyState === WebSocket.OPEN
    ) {
      ws.close();
    }
  }, LIVENESS_INTERVAL_MS);

  connect();

  return {
    close: () => {
      stopped = true;
      window.clearInterval(liveness);
      ws?.close();
    },
    subscribe: (topic) => {
      if (topics.has(topic)) return;
      topics.add(topic);
      send({ type: "subscribe", topic });
    },
    unsubscribe: (topic) => {
      if (!topics.has(topic)) return;
      topics.delete(topic);
      send({ type: "unsubscribe", topic });
    },
  };
}
