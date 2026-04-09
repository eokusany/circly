-- ============================================================
-- PROFILES: LINKED-USER READ POLICY (Fix C1)
-- ============================================================
-- Mirrors the existing "users: read linked users" policy so that
-- active supporters can read the recovery user's profile row
-- (sobriety_start_date, bio, etc.). Without this, the supporter
-- dashboard streak silently resolves to null because PostgREST
-- filters the nested `profiles(...)` join under RLS.
--
-- Journal entries remain private — they have their own table with
-- no supporter policy.
-- ============================================================

create policy "profiles: linked users read"
  on public.profiles for select
  using (
    exists (
      select 1 from public.relationships r
      where r.status = 'active'
        and (
          (r.recovery_user_id = auth.uid() and r.supporter_id = profiles.user_id) or
          (r.supporter_id = auth.uid() and r.recovery_user_id = profiles.user_id)
        )
    )
  );
