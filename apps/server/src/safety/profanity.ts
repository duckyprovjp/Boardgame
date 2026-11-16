const BANNED_WORDS = [
  'dm',
  'vcl',
  'vl',
  'cl',
  'dcm',
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'ngu',
  'chode',
];

const WORD_REGEXES = BANNED_WORDS.map(
  (w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
);

export function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_WORDS.some((w) => new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`, 'i').test(lower));
}

export function filterProfanity(text: string): string {
  let result = text;
  for (const re of WORD_REGEXES) {
    result = result.replace(re, (m) => '*'.repeat(m.length));
  }
  return result;
}
