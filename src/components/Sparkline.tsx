/**
 * Tiny SVG sparkline — renders a series as a smooth line. No external chart
 * library required; keeps the bundle small.
 */
interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  showAxis?: boolean;
  format?: (v: number) => string;
}

export function Sparkline({
  values, width = 240, height = 60, stroke = '#1a5674', fill = 'rgba(26,86,116,0.10)', showAxis = false, format,
}: SparklineProps) {
  if (values.length === 0) {
    return <div className="text-xs text-slate-400">No data</div>;
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pad = 4;
  const stepX = (width - pad * 2) / Math.max(values.length - 1, 1);
  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${path} L${(width - pad).toFixed(1)},${(height - pad).toFixed(1)} L${pad.toFixed(1)},${(height - pad).toFixed(1)} Z`;
  const last = values[values.length - 1];
  const lastPt = points[points.length - 1];
  return (
    <div className="space-y-1">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
        <path d={areaPath} fill={fill} />
        <path d={path} fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastPt[0]} cy={lastPt[1]} r={2.5} fill={stroke} />
      </svg>
      {showAxis && (
        <div className="flex justify-between text-[10px] text-slate-500 px-1">
          <span>{format ? format(min) : min}</span>
          <span>{format ? format(last) : last}</span>
          <span>{format ? format(max) : max}</span>
        </div>
      )}
    </div>
  );
}
