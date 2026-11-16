import { describe, expect, it } from 'vitest';
import { containsProfanity, filterProfanity } from './profanity';

describe('profanity filter', () => {
  it('detects profanity in usernames/text', () => {
    expect(containsProfanity('player_123')).toBe(false);
    expect(containsProfanity('bad_fuck_name')).toBe(true);
  });

  it('masks banned words in chat text', () => {
    expect(filterProfanity('Xin chào fuck bạn')).toBe('Xin chào **** bạn');
  });
});
