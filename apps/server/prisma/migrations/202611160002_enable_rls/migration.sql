-- Enable Row Level Security on every table in the public schema without creating policies.
-- This blocks Supabase auto-generated REST/GraphQL API access via anon/authenticated keys,
-- while Prisma (connecting as the database owner / postgres role) continues to work normally.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END
$$;
