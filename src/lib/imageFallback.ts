/**
 * Returns the first non-empty image candidate, or null.
 * Use with `<img src={pickImage(...) ?? "/placeholder.svg"} />`.
 */
export function pickImage(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c;
  }
  return null;
}

export const IMAGE_PLACEHOLDER = "/placeholder.svg";

export function imageOrPlaceholder(...candidates: Array<string | null | undefined>): string {
  return pickImage(...candidates) ?? IMAGE_PLACEHOLDER;
}
