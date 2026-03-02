/**
 * Pre-process ==text== → <mark>text</mark>
 *
 * Rules (to prevent accidental text consumption):
 *  - Content must start and end with a non-whitespace, non-= character
 *  - Content must not span newlines
 *  - Single character like ==a== is valid
 *  - Incomplete/single-sided == is left as-is (zero text loss)
 */
export function preprocessHighlight(content: string): string {
  return content.replace(/==(\S(?:[^\n]*?\S)?)==/g, '<mark>$1</mark>');
}
