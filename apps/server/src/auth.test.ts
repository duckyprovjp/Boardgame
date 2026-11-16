import { describe, expect, it } from 'vitest';
import { hashSessionToken, parseCookieHeader } from './auth';

describe('server auth helpers', () => {
  it('hashes session tokens deterministically and never returns raw token', () => {
    const raw = 'my-secret-token';
    const hashed = hashSessionToken(raw);
    expect(hashed).not.toBe(raw);
    expect(hashed).toHaveLength(64);
    expect(hashSessionToken(raw)).toBe(hashed);
  });

  it('parses cookie header strings accurately', () => {
    const parsed = parseCookieHeader('foo=bar; bg_session=abc123%3D; empty=');
    expect(parsed.foo).toBe('bar');
    expect(parsed.bg_session).toBe('abc123=');
    expect(parsed.empty).toBe('');
  });

  it('returns empty object for missing cookie header', () => {
    expect(parseCookieHeader(undefined)).toEqual({});
  });
});
