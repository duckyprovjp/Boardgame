import { describe, expect, it } from 'vitest';
import { PingPayloadSchema, PongPayloadSchema } from './events';

describe('shared socket event schemas', () => {
  it('validates a valid ping payload', () => {
    const parsed = PingPayloadSchema.safeParse({
      clientTime: 1700000000000,
      message: 'xin chao',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects negative clientTime in ping payload', () => {
    const parsed = PingPayloadSchema.safeParse({ clientTime: -1 });
    expect(parsed.success).toBe(false);
  });

  it('validates a valid pong payload', () => {
    const parsed = PongPayloadSchema.safeParse({
      clientTime: 1700000000000,
      serverTime: 1700000000050,
      message: 'pong',
    });
    expect(parsed.success).toBe(true);
  });
});
