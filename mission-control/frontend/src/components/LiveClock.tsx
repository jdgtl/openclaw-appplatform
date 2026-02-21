import { useState, useEffect } from "react";

export function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="text-[13px] text-text-muted tracking-wider tabular-nums">
      {time.toLocaleTimeString("en-US", { hour12: false })}
    </span>
  );
}
