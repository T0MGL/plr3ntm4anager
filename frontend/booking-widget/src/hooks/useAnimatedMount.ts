import { useEffect, useState } from "react";

export function useAnimatedMount(open: boolean, durationMs = 220) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
    else {
      const t = setTimeout(() => setMounted(false), durationMs);
      return () => clearTimeout(t);
    }
  }, [open, durationMs]);

  return mounted;
}
