import { useState, useEffect, useRef } from "react";

export function AnimCounter({
  target,
  duration = 1200,
}: {
  target: number;
  duration?: number;
}) {
  const [val, setVal] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = target;
    if (from === target) return;

    const diff = target - from;
    const steps = Math.max(1, duration / 16);
    const step = diff / steps;
    let current = from;
    let frame = 0;

    const id = setInterval(() => {
      frame++;
      current += step;
      if (frame >= steps) {
        setVal(target);
        clearInterval(id);
      } else {
        setVal(diff > 0 ? Math.min(Math.floor(current), target) : Math.max(Math.ceil(current), target));
      }
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);

  return (
    <span>
      {typeof target === "number" && target < 100 && target !== Math.floor(target)
        ? val.toFixed(2)
        : val.toLocaleString()}
    </span>
  );
}
