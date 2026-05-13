import { useFleet } from "@/stores/fleet";

export function Footer() {
  const wsConnected = useFleet((s) => s.wsConnected);
  const backendVersion = useFleet((s) => s.backendVersion);

  return (
    <footer className="h-7 bg-white border-t border-border flex items-center justify-start gap-2 px-4 text-ui-xs text-t2">
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ background: wsConnected ? "#16A34A" : "#DC2626" }}
      />
      <span style={{ color: wsConnected ? undefined : "#DC2626" }}>
        {wsConnected ? "Server connected" : "Server disconnected"}
      </span>
      {wsConnected && (
        <span
          className="text-t3"
          title={`frontend v${__APP_VERSION__} / backend v${backendVersion ?? "…"}`}
        >
          v{__APP_VERSION__} / v{backendVersion ?? "…"}
        </span>
      )}
    </footer>
  );
}
