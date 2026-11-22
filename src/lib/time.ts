export function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hh = h.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

export function timeInputToMinutes(value: string): number {
  if (!value) return NaN;
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
  return h * 60 + m;
}
