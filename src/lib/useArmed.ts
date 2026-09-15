import { useEffect, useState } from "react";

/**
 * A two-step confirm: the first click arms the button, a second within three seconds acts.
 *
 * A timer, not onBlur: a button takes no focus on click in Safari, so a blur-disarmed control
 * stays armed for good.
 */
export function useArmed(): [boolean, (armed: boolean) => void] {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return [armed, setArmed];
}
