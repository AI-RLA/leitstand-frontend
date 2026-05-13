import { useEffect } from "react";
import { Outlet } from "@tanstack/react-router";
import { Header } from "@/features/fleet/Header";
import { Footer } from "@/features/fleet/Footer";
import { api } from "./api/client";
import { useFleet } from "./stores/fleet";
import { connectWs } from "./ws/client";

export function RootLayout() {
  useEffect(() => {
    api
      .listRobots()
      .then((robots) => {
        const fleet = useFleet.getState();
        for (const r of robots) {
          fleet.setOnline(r.id, r.online);
          if (r.pose) fleet.setPose(r.id, r.pose);
          if (r.battery) fleet.setBattery(r.id, r.battery);
          if (r.state) fleet.setState(r.id, r.state);
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
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
