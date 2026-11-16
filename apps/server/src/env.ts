import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    WEB_ORIGIN: z.string().optional(),
    CORS_ORIGIN: z.string().optional(),
    COOKIE_DOMAIN: z.string().optional(),
    SESSION_SECRET: z.string().optional(),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DIRECT_URL: z.string().optional(),
    REDIS_URL: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const rawOrigin = (data.WEB_ORIGIN ?? data.CORS_ORIGIN ?? '').trim();
    if (data.NODE_ENV === 'production') {
      if (!rawOrigin || rawOrigin === '*') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['WEB_ORIGIN'],
          message: 'WEB_ORIGIN is required in production and cannot be "*"',
        });
      }
      if (!data.SESSION_SECRET || data.SESSION_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SESSION_SECRET'],
          message: 'SESSION_SECRET must be at least 32 characters in production',
        });
      }
    }
  })
  .transform((data) => {
    const rawOrigin = (
      data.WEB_ORIGIN ??
      data.CORS_ORIGIN ??
      (data.NODE_ENV === 'production' ? '' : 'http://localhost:3000')
    ).trim();
    const allowedOrigins = rawOrigin
      .split(',')
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean);
    const cookieDomain = data.COOKIE_DOMAIN?.trim() || undefined;
    const sessionSecret =
      data.SESSION_SECRET?.trim() || 'dev-session-secret-change-in-production';

    return {
      NODE_ENV: data.NODE_ENV,
      PORT: data.PORT,
      WEB_ORIGIN: allowedOrigins[0] ?? '',
      ALLOWED_ORIGINS: allowedOrigins,
      COOKIE_DOMAIN: cookieDomain,
      SESSION_SECRET: sessionSecret,
      DATABASE_URL: data.DATABASE_URL,
      DIRECT_URL: data.DIRECT_URL,
      REDIS_URL: data.REDIS_URL?.trim() || undefined,
    };
  });

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
