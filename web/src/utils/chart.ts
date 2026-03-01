/** [min, max] of numeric array */
export function extent(data: number[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of data) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

/** Linear scale: domain value → range value */
export function linearScale(
  domain: [number, number],
  range: [number, number],
): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (value: number) => r0 + ((value - d0) / span) * (r1 - r0);
}

/** Convert data points to SVG polyline points string */
export function toPolylinePoints(
  data: { x: number; y: number }[],
  width: number,
  height: number,
  padding = 2,
): string {
  if (data.length === 0) return '';
  const xs = data.map(d => d.x);
  const ys = data.map(d => d.y);
  const scaleX = linearScale(extent(xs), [padding, width - padding]);
  const scaleY = linearScale(extent(ys), [height - padding, padding]);
  return data.map(d => `${scaleX(d.x)},${scaleY(d.y)}`).join(' ');
}
