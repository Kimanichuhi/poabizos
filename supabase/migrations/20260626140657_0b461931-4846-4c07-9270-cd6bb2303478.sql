
-- ============================================================
-- 1. subscription_packages
-- ============================================================
CREATE TABLE public.subscription_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_code TEXT NOT NULL UNIQUE,
  package_name TEXT NOT NULL,
  monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'KES',
  description TEXT,
  user_limit INT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_packages TO authenticated, anon;
GRANT ALL ON public.subscription_packages TO service_role;
ALTER TABLE public.subscription_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packages readable by all" ON public.subscription_packages FOR SELECT USING (true);
CREATE POLICY "packages admin write" ON public.subscription_packages FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));

-- ============================================================
-- 2. features
-- ============================================================
CREATE TABLE public.features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT NOT NULL UNIQUE,
  feature_name TEXT NOT NULL,
  module TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.features TO authenticated, anon;
GRANT ALL ON public.features TO service_role;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "features readable by all" ON public.features FOR SELECT USING (true);
CREATE POLICY "features admin write" ON public.features FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));

-- ============================================================
-- 3. package_features
-- ============================================================
CREATE TABLE public.package_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.subscription_packages(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (package_id, feature_id)
);
GRANT SELECT ON public.package_features TO authenticated, anon;
GRANT ALL ON public.package_features TO service_role;
ALTER TABLE public.package_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pkgfeat readable by all" ON public.package_features FOR SELECT USING (true);
CREATE POLICY "pkgfeat admin write" ON public.package_features FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));

-- ============================================================
-- 4. tenant_subscriptions
-- ============================================================
CREATE TABLE public.tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.subscription_packages(id),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'active', -- active, trial, suspended, cancelled
  auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX tenant_subscriptions_one_active ON public.tenant_subscriptions(tenant_id) WHERE status IN ('active','trial');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_subscriptions TO authenticated;
GRANT ALL ON public.tenant_subscriptions TO service_role;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tsub tenant select" ON public.tenant_subscriptions FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id() OR public.is_platform_admin(auth.uid()));
CREATE POLICY "tsub admin write" ON public.tenant_subscriptions FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));

-- ============================================================
-- 5. updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_pkg_uat BEFORE UPDATE ON public.subscription_packages FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_tsub_uat BEFORE UPDATE ON public.tenant_subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 6. Seed packages
-- ============================================================
INSERT INTO public.subscription_packages (package_code, package_name, monthly_price, description, user_limit, sort_order) VALUES
  ('starter',  'Starter',  300,  'For salons, barbershops, small retail shops, boutiques and small service businesses.', 2,    1),
  ('growth',   'Growth',   700,  'For growing SMEs that need debtors, suppliers and richer reporting.',                  5,    2),
  ('business', 'Business', 1200, 'For established businesses needing HR, payroll, assets and advanced reports.',         15,   3),
  ('premium',  'Premium',  2000, 'For businesses requiring multi-branch, integrations and AI automation.',               NULL, 4);

-- ============================================================
-- 7. Seed features (full catalog)
-- ============================================================
INSERT INTO public.features (feature_key, feature_name, module) VALUES
  ('dashboard',                  'Dashboard',                  'Core'),
  ('sales',                      'Sales Management',           'Sales'),
  ('products',                   'Products Module',            'Inventory'),
  ('product_categories',         'Product Categories',         'Inventory'),
  ('inventory',                  'Inventory Tracking',         'Inventory'),
  ('inventory_basic',            'Basic Inventory Tracking',   'Inventory'),
  ('auto_stock_deduction',       'Automatic Stock Deduction',  'Inventory'),
  ('stock_movements',            'Stock Movement History',     'Inventory'),
  ('low_stock_alerts_dashboard', 'Dashboard Low Stock Alerts', 'Inventory'),
  ('low_stock_alerts',           'Low Stock Alerts',           'Inventory'),
  ('expenses',                   'Expense Management',         'Finance'),
  ('customers',                  'Customer Records',           'CRM'),
  ('debtors',                    'Debtors Management',         'Finance'),
  ('suppliers',                  'Supplier Records',           'Procurement'),
  ('employees',                  'Employee Management',        'HR'),
  ('attendance',                 'Attendance Tracking',        'HR'),
  ('payroll',                    'Payroll',                    'HR'),
  ('hr',                         'Human Resources',            'HR'),
  ('assets',                     'Asset Management',           'Operations'),
  ('tasks',                      'Task Management',            'Operations'),
  ('appointments',               'Appointment Booking',        'Operations'),
  ('multi_branch',               'Multi-Branch Management',    'Operations'),
  ('reports',                    'Basic Reports',              'Reports'),
  ('reports_inventory',          'Inventory Reports',          'Reports'),
  ('reports_product_sales',      'Product Sales Reports',      'Reports'),
  ('reports_profit_loss',        'Profit & Loss Reports',      'Reports'),
  ('reports_department',         'Department Reports',         'Reports'),
  ('reports_advanced',           'Advanced Reports',           'Reports'),
  ('stock_reports',              'Stock Reports',              'Reports'),
  ('mpesa',                      'M-Pesa Integration',         'Integrations'),
  ('sms',                        'SMS Notifications',          'Integrations'),
  ('whatsapp',                   'WhatsApp Notifications',     'Integrations'),
  ('ai_assistant',               'AI Business Assistant',      'AI'),
  ('ai_analytics',               'AI Business Analytics',      'AI'),
  ('ai_inventory_forecast',      'AI Inventory Forecasting',   'AI'),
  ('ai_sales_forecast',          'AI Sales Forecasting',       'AI');

-- ============================================================
-- 8. Map features to packages
-- ============================================================
-- helper macro via CTE
WITH pkg AS (SELECT id, package_code FROM public.subscription_packages),
     feat AS (SELECT id, feature_key FROM public.features)
INSERT INTO public.package_features (package_id, feature_id)
SELECT p.id, f.id
FROM (VALUES
  -- STARTER
  ('starter','dashboard'),('starter','sales'),('starter','products'),('starter','product_categories'),
  ('starter','inventory_basic'),('starter','auto_stock_deduction'),('starter','expenses'),
  ('starter','customers'),('starter','appointments'),('starter','reports'),
  ('starter','low_stock_alerts_dashboard'),
  -- GROWTH (Starter + ...)
  ('growth','dashboard'),('growth','sales'),('growth','products'),('growth','product_categories'),
  ('growth','inventory'),('growth','auto_stock_deduction'),('growth','stock_movements'),
  ('growth','expenses'),('growth','customers'),('growth','debtors'),('growth','suppliers'),
  ('growth','low_stock_alerts'),('growth','low_stock_alerts_dashboard'),
  ('growth','reports'),('growth','reports_inventory'),('growth','reports_product_sales'),('growth','reports_profit_loss'),
  ('growth','appointments'),('growth','stock_reports'),
  -- BUSINESS
  ('business','dashboard'),('business','sales'),('business','products'),('business','product_categories'),
  ('business','inventory'),('business','auto_stock_deduction'),('business','stock_movements'),
  ('business','expenses'),('business','customers'),('business','debtors'),('business','suppliers'),
  ('business','employees'),('business','attendance'),('business','payroll'),('business','hr'),
  ('business','assets'),('business','tasks'),('business','appointments'),
  ('business','low_stock_alerts'),('business','low_stock_alerts_dashboard'),
  ('business','reports'),('business','reports_inventory'),('business','reports_product_sales'),
  ('business','reports_profit_loss'),('business','reports_department'),('business','reports_advanced'),
  ('business','stock_reports'),
  -- PREMIUM (all)
  ('premium','dashboard'),('premium','sales'),('premium','products'),('premium','product_categories'),
  ('premium','inventory'),('premium','auto_stock_deduction'),('premium','stock_movements'),
  ('premium','expenses'),('premium','customers'),('premium','debtors'),('premium','suppliers'),
  ('premium','employees'),('premium','attendance'),('premium','payroll'),('premium','hr'),
  ('premium','assets'),('premium','tasks'),('premium','appointments'),
  ('premium','multi_branch'),
  ('premium','low_stock_alerts'),('premium','low_stock_alerts_dashboard'),
  ('premium','reports'),('premium','reports_inventory'),('premium','reports_product_sales'),
  ('premium','reports_profit_loss'),('premium','reports_department'),('premium','reports_advanced'),
  ('premium','stock_reports'),
  ('premium','mpesa'),('premium','sms'),('premium','whatsapp'),
  ('premium','ai_assistant'),('premium','ai_analytics'),
  ('premium','ai_inventory_forecast'),('premium','ai_sales_forecast')
) AS m(pcode, fkey)
JOIN pkg p ON p.package_code = m.pcode
JOIN feat f ON f.feature_key = m.fkey;

-- ============================================================
-- 9. Seed tenant_subscriptions from existing tenants.subscription_plan
-- ============================================================
INSERT INTO public.tenant_subscriptions (tenant_id, package_id, start_date, status)
SELECT t.id, p.id, COALESCE(t.created_at::date, CURRENT_DATE),
  CASE WHEN t.subscription_status::text IN ('active','trial','suspended','cancelled')
       THEN t.subscription_status::text ELSE 'active' END
FROM public.tenants t
JOIN public.subscription_packages p ON p.package_code = t.subscription_plan::text
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10. Replace plan_features with a compatibility view
-- ============================================================
DROP TABLE IF EXISTS public.plan_features CASCADE;
CREATE VIEW public.plan_features AS
  SELECT p.package_code AS plan_name, f.feature_key
  FROM public.package_features pf
  JOIN public.subscription_packages p ON p.id = pf.package_id
  JOIN public.features f ON f.id = pf.feature_id;
GRANT SELECT ON public.plan_features TO authenticated, anon;

-- ============================================================
-- 11. Updated tenant_has_feature
-- ============================================================
CREATE OR REPLACE FUNCTION public.tenant_has_feature(_tenant_id uuid, _feature_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_subscriptions ts
    JOIN public.package_features pf ON pf.package_id = ts.package_id
    JOIN public.features f ON f.id = pf.feature_id
    WHERE ts.tenant_id = _tenant_id
      AND ts.status IN ('active','trial')
      AND f.feature_key = _feature_key
  ) OR EXISTS (
    -- fallback to legacy tenants.subscription_plan if no tenant_subscription row
    SELECT 1
    FROM public.tenants t
    JOIN public.subscription_packages sp ON sp.package_code = t.subscription_plan::text
    JOIN public.package_features pf ON pf.package_id = sp.id
    JOIN public.features f ON f.id = pf.feature_id
    WHERE t.id = _tenant_id AND f.feature_key = _feature_key
  );
$$;

-- ============================================================
-- 12. Helper: get_tenant_features (returns all feature keys for a tenant)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_tenant_features(_tenant_id uuid)
RETURNS TABLE(feature_key text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT f.feature_key
  FROM public.tenant_subscriptions ts
  JOIN public.package_features pf ON pf.package_id = ts.package_id
  JOIN public.features f ON f.id = pf.feature_id
  WHERE ts.tenant_id = _tenant_id AND ts.status IN ('active','trial')
  UNION
  SELECT DISTINCT f.feature_key
  FROM public.tenants t
  JOIN public.subscription_packages sp ON sp.package_code = t.subscription_plan::text
  JOIN public.package_features pf ON pf.package_id = sp.id
  JOIN public.features f ON f.id = pf.feature_id
  WHERE t.id = _tenant_id
    AND NOT EXISTS (SELECT 1 FROM public.tenant_subscriptions x WHERE x.tenant_id = t.id AND x.status IN ('active','trial'));
$$;

-- ============================================================
-- 13. RPC: change_tenant_package (admin or tenant_admin) — for upgrade/downgrade
-- ============================================================
CREATE OR REPLACE FUNCTION public.change_tenant_package(_package_code text)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _tid UUID := public.get_my_tenant_id();
        _pid UUID;
        _sub_id UUID;
BEGIN
  IF _tid IS NULL THEN RAISE EXCEPTION 'No tenant'; END IF;
  IF NOT (public.has_tenant_role(auth.uid(), _tid, 'tenant_admin') OR public.is_platform_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT id INTO _pid FROM public.subscription_packages WHERE package_code = _package_code AND is_active = TRUE;
  IF _pid IS NULL THEN RAISE EXCEPTION 'Unknown package'; END IF;

  UPDATE public.tenant_subscriptions
    SET status = 'cancelled', updated_at = now()
    WHERE tenant_id = _tid AND status IN ('active','trial');

  INSERT INTO public.tenant_subscriptions (tenant_id, package_id, start_date, status)
    VALUES (_tid, _pid, CURRENT_DATE, 'active')
    RETURNING id INTO _sub_id;

  UPDATE public.tenants SET subscription_plan = _package_code::plan_tier, updated_at = now() WHERE id = _tid;
  RETURN _sub_id;
END $$;

-- ============================================================
-- 14. Products: add brand, unit, archived_at (soft delete)
-- ============================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'piece',
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_products_archived ON public.products(tenant_id) WHERE archived_at IS NULL;
