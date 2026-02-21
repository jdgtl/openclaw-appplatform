/**
 * Animated ECG-style heartbeat line.
 * - alive=true  → green heartbeat scrolling right-to-left
 * - alive=false → red flatline, static
 */

const SEGMENT_W = 120;
const H = 40;
const BASELINE = 22;
const SEGMENTS = 4; // enough to tile + scroll seamlessly

function segment(ox: number): string {
  const y = BASELINE;
  return [
    `L${ox + 25},${y}`,
    // P-wave
    `L${ox + 31},${y - 4}`,
    `L${ox + 37},${y}`,
    // flat before QRS
    `L${ox + 42},${y}`,
    // QRS complex
    `L${ox + 46},${y - 17}`,
    `L${ox + 50},${y + 13}`,
    `L${ox + 53},${y - 3}`,
    `L${ox + 56},${y}`,
    // flat
    `L${ox + 68},${y}`,
    // T-wave
    `L${ox + 75},${y - 5}`,
    `L${ox + 82},${y}`,
    // flat to end
    `L${ox + SEGMENT_W},${y}`,
  ].join(" ");
}

const heartbeatPath =
  `M0,${BASELINE} ` +
  Array.from({ length: SEGMENTS }, (_, i) => segment(i * SEGMENT_W)).join(" ");

const flatlinePath = `M0,${BASELINE} L${SEGMENT_W * SEGMENTS},${BASELINE}`;

// Filled version (close path along bottom for gradient)
function filledPath(d: string): string {
  const totalW = SEGMENT_W * SEGMENTS;
  return `${d} L${totalW},${H} L0,${H} Z`;
}

export function HeartbeatLine({
  alive,
  height = H,
}: {
  alive: boolean;
  height?: number;
}) {
  const color = alive ? "#22c55e" : "#ef4444";
  const viewW = SEGMENT_W * 2; // show 2 segments in the window
  const dur = "1.6s"; // ~75 BPM feel

  return (
    <div className="w-full overflow-hidden" style={{ height }}>
      <svg
        viewBox={`0 0 ${viewW} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="hb-fill-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="hb-fill-r" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>

        <g
          style={
            alive
              ? {
                  animation: `hb-scroll ${dur} linear infinite`,
                }
              : undefined
          }
        >
          {/* Gradient fill */}
          <path
            d={filledPath(alive ? heartbeatPath : flatlinePath)}
            fill={alive ? "url(#hb-fill-g)" : "url(#hb-fill-r)"}
          />
          {/* Glow line (blurred duplicate) */}
          <path
            d={alive ? heartbeatPath : flatlinePath}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            opacity={0.3}
          />
          {/* Main line */}
          <path
            d={alive ? heartbeatPath : flatlinePath}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}
