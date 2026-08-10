import { wsSubprotocols } from "@/api/auth";
import type { Battery, Pose, RobotStatus } from "@/api/client";
import { useFleet } from "@/stores/fleet";

type TopicHandler = (topic: string, payload: unknown) => void;
const _listeners = new Map<string, Set<TopicHandler>>();
let _wsHandle: WsHandle | null = null;

export function addTopicListener(
  topicPrefix: string,
  handler: TopicHandler,
): () => void {
  if (!_listeners.has(topicPrefix)) _listeners.set(topicPrefix, new Set());
  _listeners.get(topicPrefix)!.add(handler);
  _wsHandle?.subscribe(topicPrefix);
  return () => {
    const set = _listeners.get(topicPrefix);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      _listeners.delete(topicPrefix);
      _wsHandle?.unsubscribe(topicPrefix);
    }
  };
}

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

function isRobotStatusPayload(p: unknown): p is { status: RobotStatus } {
  if (typeof p !== "object" || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.status === "string" &&
    ["offline", "charging", "active", "idle"].includes(o.status)
  );
}

export function connectWs(): WsHandle {
  let ws: WebSocket | null = null;
  let reconnectAfter = 500;
  let stopped = false;
  let lastPing = Date.now();
  let attempts = 0;
  const STATIC_TOPICS = ["events/registry", "events/robot"];
  const topics = new Set<string>(STATIC_TOPICS);

  function send(frame: object): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(frame));
    }
  }

  function connect(): void {
    attempts += 1;
    console.info(`[ws] connecting… (attempt ${attempts})`);
    ws = new WebSocket(resolveUrl(), wsSubprotocols());

    ws.addEventListener("open", () => {
      reconnectAfter = 500;
      lastPing = Date.now();
      useFleet.getState().setWsConnected(true);
      // Rebuild the subscription set from scratch each (re)connect: static topics
      // plus the currently-live listener prefixes. Rebuilding (rather than
      // accumulating) discards stale dynamic prefixes left over from before.
      topics.clear();
      for (const t of STATIC_TOPICS) topics.add(t);
      for (const prefix of _listeners.keys()) topics.add(prefix);
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
      // Dispatch to registered topic listeners (e.g. mission state).
      for (const [prefix, handlers] of _listeners) {
        // Segment-aware match (all topics use the '/' hierarchy): the prefix
        // itself, or a path continuing after a '/'.
        if (f.topic === prefix || f.topic.startsWith(prefix + "/")) {
          for (const h of handlers) h(f.topic, f.payload);
        }
      }
      const fleet = useFleet.getState();
      if (f.topic === "events/registry") {
        const p = f.payload as { type?: string; robot_id?: string };
        if (typeof p?.robot_id !== "string") return;
        if (p.type === "robot.online") fleet.setOnline(p.robot_id, true);
        else if (p.type === "robot.offline") fleet.setOnline(p.robot_id, false);
      } else if (f.topic.startsWith("events/robot/")) {
        // events/robot/<id>/<kind>
        const segs = f.topic.split("/");
        const id = segs[2];
        const kind = segs[3];
        if (!id || !kind) return;
        if (kind === "pose" && isPose(f.payload)) fleet.setPose(id, f.payload);
        else if (kind === "battery" && isBattery(f.payload))
          fleet.setBattery(id, f.payload);
        else if (kind === "status" && isRobotStatusPayload(f.payload))
          fleet.setStatus(id, f.payload.status);
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

  const handle: WsHandle = {
    close: () => {
      stopped = true;
      window.clearInterval(liveness);
      // Only clear the module global if this handle still owns it: otherwise a
      // late close() from a torn-down handle would wipe a newer live connection
      // (StrictMode remount / reconnect races), silently killing subscriptions.
      if (_wsHandle === handle) _wsHandle = null;
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
  _wsHandle = handle;
  return handle;
}
