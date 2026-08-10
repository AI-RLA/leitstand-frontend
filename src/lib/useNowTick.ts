import { useEffect, useState } from "react";

/**
 * Re-render every `intervalMs` while `active`, returning the current epoch ms.
 *
 * For live elapsed-time displays that would otherwise only advance when data is
 * refetched (REST poll) or a WS frame arrives, making the clock look frozen.
 */
export function useNowTick(intervalMs: number, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, active]);
  return now;
}
