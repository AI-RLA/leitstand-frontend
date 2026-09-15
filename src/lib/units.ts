/** An area as an operator reads it: hectares from one hectare up, square metres below. */
export function formatArea(m2: number): string {
  return m2 >= 10_000
    ? `${(m2 / 10_000).toFixed(2)} ha`
    : `${Math.round(m2).toLocaleString()} m²`;
}
