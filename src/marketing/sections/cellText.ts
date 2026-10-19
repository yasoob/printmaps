/**
Short numeric values such as "215.9 × 279.4 mm" or "300 dpi" should stay on one line.
*/
export function isCompactValue(text: string): boolean {
  return text.length <= 28 && /^[~≈<>]?\s?\d/.test(text);
}
