import { useEffect } from "react";
import { Outlet } from "@tanstack/react-router";
import { Header } from "@/features/fleet/Header";
import { Footer } from "@/features/fleet/Footer";
import { SidePanel } from "@/components/layout/SidePanel";
import { api } from "./api/client";
import { useFleet } from "./stores/fleet";
import { connectWs } from "./ws/client";
import { useMissionLifecycleSync } from "./ws/useMissionLifecycleSync";

export function RootLayout() {
  useMissionLifecycleSync();
  useEffect(() => {
    api
      .listRobots()
      .then((robots) => {
        const fleet = useFleet.getState();
        for (const r of robots) {
          fleet.setOnline(r.id, r.online);
          if (r.pose) fleet.setPose(r.id, r.pose);
          if (r.battery) fleet.setBattery(r.id, r.battery);
          fleet.setStatus(r.id, r.status);
        }
      })
      .catch((err) => {
        console.error("[seed] listRobots failed:", err);
      });
    const conn = connectWs();
    return () => conn.close();
  }, []);
  return (
    <div className="h-screen flex flex-col">
      <Header />
      {/* A sibling of the route, not part of it, so a streaming turn and a pending approval
          survive navigation instead of unmounting with the page that opened them. */}
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-hidden">
          <Outlet />
        </div>
        <SidePanel />
      </main>
      <Footer />
    </div>
  );
}
