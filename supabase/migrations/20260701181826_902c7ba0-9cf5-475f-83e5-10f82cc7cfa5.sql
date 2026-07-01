
-- 1. Tenant branding & settings
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS theme_primary TEXT,
  ADD COLUMN IF NOT EXISTS theme_accent TEXT,
  ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'KES',
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Nairobi';

-- 2. Update tenant settings RPC (admin only)
CREATE OR REPLACE FUNCTION public.update_tenant_settings(_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tid uuid := public.get_my_tenant_id();
BEGIN
  IF _tid IS NULL THEN RAISE EXCEPTION 'No tenant'; END IF;
  IF NOT (public.has_tenant_role(auth.uid(), _tid, 'tenant_admin') OR public.is_platform_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.tenants SET
    business_name = COALESCE(NULLIF(_payload->>'business_name',''), business_name),
    logo_url      = CASE WHEN _payload ? 'logo_url' THEN NULLIF(_payload->>'logo_url','') ELSE logo_url END,
    theme_primary = CASE WHEN _payload ? 'theme_primary' THEN NULLIF(_payload->>'theme_primary','') ELSE theme_primary END,
    theme_accent  = CASE WHEN _payload ? 'theme_accent' THEN NULLIF(_payload->>'theme_accent','') ELSE theme_accent END,
    theme_mode    = COALESCE(NULLIF(_payload->>'theme_mode',''), theme_mode),
    locale        = COALESCE(NULLIF(_payload->>'locale',''), locale),
    currency      = COALESCE(NULLIF(_payload->>'currency',''), currency),
    timezone      = COALESCE(NULLIF(_payload->>'timezone',''), timezone),
    phone         = COALESCE(NULLIF(_payload->>'phone',''), phone),
    email         = COALESCE(NULLIF(_payload->>'email',''), email),
    updated_at = now()
  WHERE id = _tid;
END $$;

-- 3. Server-side profit history aggregation (fast for 90d/YTD/All)
CREATE OR REPLACE FUNCTION public.product_profit_history(_product_id uuid, _from date, _to date)
RETURNS TABLE(day date, units numeric, revenue numeric, cost numeric, profit numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    s.sale_date::date AS day,
    SUM(si.quantity)::numeric AS units,
    SUM(si.line_total)::numeric AS revenue,
    SUM(si.quantity * COALESCE(p.cost,0))::numeric AS cost,
    SUM(si.line_total - si.quantity * COALESCE(p.cost,0))::numeric AS profit
  FROM public.sale_items si
  JOIN public.sales s   ON s.id = si.sale_id
  JOIN public.products p ON p.id = si.product_id
  WHERE si.product_id = _product_id
    AND si.tenant_id = public.get_my_tenant_id()
    AND s.sale_date BETWEEN _from AND _to
  GROUP BY 1
  ORDER BY 1;
$$;

-- 4. Helpful indexes
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON public.sale_items(product_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_date         ON public.sales(tenant_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_products_barcode   ON public.products(tenant_id, barcode);
CREATE INDEX IF NOT EXISTS idx_stock_movements_prod ON public.stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_time ON public.audit_logs(tenant_id, created_at DESC);

-- 5. Tenant admin RPCs to manage users (uses admin server-fn for auth create)
CREATE OR REPLACE FUNCTION public.remove_tenant_user(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tid uuid := public.get_my_tenant_id();
BEGIN
  IF _tid IS NULL OR NOT public.has_tenant_role(auth.uid(), _tid, 'tenant_admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'Cannot remove yourself'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND tenant_id = _tid;
  UPDATE public.profiles SET tenant_id = NULL WHERE id = _user_id AND tenant_id = _tid;
END $$;

CREATE OR REPLACE FUNCTION public.change_tenant_user_role(_user_id uuid, _new_role app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tid uuid := public.get_my_tenant_id();
BEGIN
  IF _tid IS NULL OR NOT public.has_tenant_role(auth.uid(), _tid, 'tenant_admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _new_role = 'platform_super_admin' THEN RAISE EXCEPTION 'Cannot assign platform role'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND tenant_id = _tid;
  INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES (_user_id, _new_role, _tid);
END $$;

-- 6. Employees table: only tenant_admin can INSERT (manager blocked from HR employees).
-- Recreate insert policy specifically.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employees' AND policyname='tenant members can insert employees') THEN
    EXECUTE 'DROP POLICY "tenant members can insert employees" ON public.employees';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employees' AND policyname='employees_insert_tenant') THEN
    EXECUTE 'DROP POLICY "employees_insert_tenant" ON public.employees';
  END IF;
END $$;
CREATE POLICY "employees_insert_admin_only" ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_my_tenant_id()
    AND (public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin') OR public.is_platform_admin(auth.uid()))
  );

-- 7. Product barcode lookup (RLS-scoped SECURITY DEFINER for quick scan)
CREATE OR REPLACE FUNCTION public.find_product_by_barcode(_code text)
RETURNS TABLE(id uuid, name text, sku text, price numeric, cost numeric, stock_quantity int, is_service boolean, barcode text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, sku, price, cost, stock_quantity, is_service, barcode
  FROM public.products
  WHERE tenant_id = public.get_my_tenant_id()
    AND (barcode = _code OR sku = _code)
    AND archived_at IS NULL
  LIMIT 1;
$$;
