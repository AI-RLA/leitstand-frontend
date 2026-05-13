import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useFleet } from "@/stores/fleet";

function NavLink({ to, label }: { to: string; label: string }) {
  const state = useRouterState();
  const active =
    state.location.pathname === to ||
    state.location.pathname.startsWith(to + "/");
  return (
    <Link to={to} className={active ? "text-primary font-semibold" : "text-t2"}>
      {label}
    </Link>
  );
}

export function Header() {
  const robots = useFleet((s) => s.robots);
  const alertCount = Object.values(robots).filter(
    (r) => r.state?.status === "alert",
  ).length;
  const { data: user } = useCurrentUser();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(t);
  }, []);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return (
    <header className="h-12 bg-white border-b border-border flex items-center px-4 gap-6">
      <div className="flex items-center gap-2">
        <div
          className="w-[26px] h-[26px] rounded-[7px] bg-primary flex items-center justify-center text-white"
          aria-hidden
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="6" y="9" width="12" height="9" rx="2" />
            <path d="M9 9V6h6v3" />
            <circle cx="9" cy="14" r="1" fill="currentColor" />
            <circle cx="15" cy="14" r="1" fill="currentColor" />
          </svg>
        </div>
        <span className="text-[16px] font-bold text-t1">Leitstand</span>
      </div>
      <nav className="flex items-center gap-5 text-ui-lg">
        <NavLink to="/" label="Overview" />
        <NavLink to="/fields" label="Fields" />
        <span className="text-t2">Missions</span>
        <span className="text-t2">AI Agents</span>
      </nav>
      <div className="flex-1" />
      {user?.name && <span className="text-ui-sm text-t2">{user.name}</span>}
      {alertCount > 0 && (
        <div className="text-ui-sm text-[#B91C1C] bg-[#FEF2F2] border border-[#FCA5A5] rounded px-2 py-[2px]">
          {alertCount} Alert{alertCount === 1 ? "" : "s"}
        </div>
      )}
      <div className="text-ui-sm text-t3 font-mono">
        {hh}:{mm}:{ss}
      </div>
    </header>
  );
}
