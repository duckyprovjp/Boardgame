import { filterProfanity } from './safety/profanity';

/**
 * Sanitizes user-submitted chat text by removing angle brackets, control chars, and profanity.
 */
export function sanitizeChatText(input: string, maxLength = 300): string {
  const withoutControlChars = Array.from(input)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code > 0x1f && code !== 0x7f;
    })
    .join('');

  const clean = withoutControlChars
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

  return filterProfanity(clean);
}
