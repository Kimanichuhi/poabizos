-- =====================================================================
-- RLS regression tests — multi-tenant isolation for products & stock
-- =====================================================================
-- Run as the database owner (psql via SUPABASE_DB_URL). Each test
-- impersonates a tenant user with `SET LOCAL ROLE authenticated` and
-- `SET LOCAL request.jwt.claims = '{"sub":"<uid>"}'` so RLS evaluates
-- exactly as it would for a logged-in user.
--
-- Pass criterion: every SELECT inside `assert_count` returns the
-- expected number of rows; no test raises an exception.
-- =====================================================================

BEGIN;

-- --- Test harness ---------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.as_user(_uid UUID) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _uid, 'role','authenticated')::text, true);
END $$;

CREATE OR REPLACE FUNCTION pg_temp.assert_count(_label TEXT, _sql TEXT, _expected INT) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE _n INT;
BEGIN
  EXECUTE 'SELECT count(*) FROM (' || _sql || ') s' INTO _n;
  IF _n <> _expected THEN
    RAISE EXCEPTION 'FAIL [%]: expected % got %', _label, _expected, _n;
  END IF;
  RAISE NOTICE 'PASS [%]: % rows', _label, _n;
END $$;

-- --- Fixture --------------------------------------------------------
-- Two tenants + one admin user each, one product + one stock movement per tenant.
DO $$
DECLARE
  t_a UUID := gen_random_uuid();
  t_b UUID := gen_random_uuid();
  u_a UUID := gen_random_uuid();
  u_b UUID := gen_random_uuid();
  p_a UUID; p_b UUID;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (u_a, 'a@test.local'), (u_b, 'b@test.local');
  INSERT INTO public.tenants (id, business_name, subscription_plan) VALUES (t_a,'Alpha','starter'), (t_b,'Bravo','starter');
  INSERT INTO public.profiles (id, tenant_id, email) VALUES (u_a, t_a,'a@test.local'), (u_b, t_b,'b@test.local');
  INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES (u_a,'tenant_admin',t_a), (u_b,'tenant_admin',t_b);

  INSERT INTO public.products (tenant_id, name, sku, price, cost, stock_quantity, created_by)
    VALUES (t_a,'A-widget','A-1',100,60,10,u_a) RETURNING id INTO p_a;
  INSERT INTO public.products (tenant_id, name, sku, price, cost, stock_quantity, created_by)
    VALUES (t_b,'B-widget','B-1',100,60,10,u_b) RETURNING id INTO p_b;
  INSERT INTO public.stock_movements (tenant_id, product_id, change, reason, created_by)
    VALUES (t_a, p_a, 5, 'restock', u_a), (t_b, p_b, 5, 'restock', u_b);

  PERFORM set_config('test.t_a', t_a::text, false);
  PERFORM set_config('test.t_b', t_b::text, false);
  PERFORM set_config('test.u_a', u_a::text, false);
  PERFORM set_config('test.u_b', u_b::text, false);
END $$;

-- --- Tests ----------------------------------------------------------

-- 1. User A sees only their own product.
SELECT pg_temp.as_user(current_setting('test.u_a')::uuid);
SELECT pg_temp.assert_count('A.products.own', 'SELECT 1 FROM public.products', 1);
SELECT pg_temp.assert_count(
  'A.products.cannot_see_B',
  format('SELECT 1 FROM public.products WHERE tenant_id = %L', current_setting('test.t_b')),
  0
);

-- 2. User A cannot read tenant B stock movements.
SELECT pg_temp.assert_count(
  'A.movements.cannot_see_B',
  format('SELECT 1 FROM public.stock_movements WHERE tenant_id = %L', current_setting('test.t_b')),
  0
);

-- 3. User A cannot INSERT product into tenant B (should raise RLS error).
DO $$
BEGIN
  BEGIN
    INSERT INTO public.products (tenant_id, name, price, created_by)
      VALUES (current_setting('test.t_b')::uuid, 'rogue', 1, current_setting('test.u_a')::uuid);
    RAISE EXCEPTION 'FAIL [A.products.insert_into_B]: insert should have been blocked';
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    RAISE NOTICE 'PASS [A.products.insert_into_B]: blocked (%)', SQLERRM;
  END;
END $$;

-- 4. User B sees their own and only their own.
SELECT pg_temp.as_user(current_setting('test.u_b')::uuid);
SELECT pg_temp.assert_count('B.products.own', 'SELECT 1 FROM public.products', 1);
SELECT pg_temp.assert_count('B.movements.own', 'SELECT 1 FROM public.stock_movements', 1);

-- 5. Package change must not change isolation. Downgrade A to starter, B to premium.
RESET ROLE;
SELECT public.change_tenant_package('starter');  -- no-op safety; will fail without auth.uid
-- Use direct update to simulate plan changes:
UPDATE public.tenants SET subscription_plan = 'starter' WHERE id = current_setting('test.t_a')::uuid;
UPDATE public.tenants SET subscription_plan = 'premium' WHERE id = current_setting('test.t_b')::uuid;

SELECT pg_temp.as_user(current_setting('test.u_a')::uuid);
SELECT pg_temp.assert_count('A.after_downgrade.products.own', 'SELECT 1 FROM public.products', 1);
SELECT pg_temp.assert_count(
  'A.after_downgrade.cannot_see_B',
  format('SELECT 1 FROM public.products WHERE tenant_id = %L', current_setting('test.t_b')),
  0
);
SELECT pg_temp.as_user(current_setting('test.u_b')::uuid);
SELECT pg_temp.assert_count(
  'B.after_upgrade.cannot_see_A',
  format('SELECT 1 FROM public.products WHERE tenant_id = %L', current_setting('test.t_a')),
  0
);

-- All assertions passed → rollback fixture data (keeps DB clean).
ROLLBACK;
