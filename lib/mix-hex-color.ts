/** Linear blend between two `#RRGGBB` colors (amount 0 = from, 1 = to). */
export function mixHexColors(from: string, to: string, amount: number): string {
  const t = Math.min(1, Math.max(0, amount));
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const channel = (a: number, b: number) => Math.round(a + (b - a) * t);
  const r = channel(r1, r2);
  const g = channel(g1, g2);
  const b = channel(b1, b2);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
