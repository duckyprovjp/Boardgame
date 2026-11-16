import { describe, expect, it } from 'vitest';
import {
  GuestLoginSchema,
  LoginSchema,
  RegisterSchema,
  UpdateProfileSchema,
} from './auth';

describe('auth & profile schemas', () => {
  it('validates valid registration input and normalizes email', () => {
    const parsed = RegisterSchema.safeParse({
      email: ' PlayerOne@Example.com ',
      password: 'secret123',
      username: 'player_1',
      avatarId: 'cat',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe('playerone@example.com');
      expect(parsed.data.avatarId).toBe('cat');
    }
  });

  it('rejects invalid username characters', () => {
    const parsed = UpdateProfileSchema.safeParse({
      username: 'bad name!',
      avatarId: 'fox',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects unknown avatarId', () => {
    const parsed = UpdateProfileSchema.safeParse({
      username: 'valid_user',
      avatarId: 'unknown_avatar',
    });
    expect(parsed.success).toBe(false);
  });

  it('allows guest login without username', () => {
    const parsed = GuestLoginSchema.safeParse({});
    expect(parsed.success).toBe(true);
  });

  it('validates login schema', () => {
    const parsed = LoginSchema.safeParse({
      email: 'a@b.com',
      password: '123',
    });
    expect(parsed.success).toBe(true);
  });
});
