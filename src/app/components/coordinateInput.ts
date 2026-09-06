export function isCoordinateInputInvalid(
  value: string,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);
  return value.trim() === ""
    || !Number.isFinite(parsed)
    || parsed < minimum
    || parsed > maximum;
}
