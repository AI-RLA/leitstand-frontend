// Operators type decimal commas, so a comma counts as the decimal point.
const DECIMAL = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/;

/** Parse a number typed as text, or return NaN when the text is not a plain decimal. */
export function parseDecimal(text: string): number {
  const trimmed = text.trim();
  return DECIMAL.test(trimmed) ? Number(trimmed.replace(",", ".")) : NaN;
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** An area as an operator reads it: hectares from one hectare up, square metres below. */
export function formatArea(m2: number): string {
  return m2 >= 10_000
    ? `${(m2 / 10_000).toFixed(2)} ha`
    : `${Math.round(m2).toLocaleString()} m²`;
}
