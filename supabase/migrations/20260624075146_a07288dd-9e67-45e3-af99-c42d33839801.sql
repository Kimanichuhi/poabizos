
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('platform_super_admin','tenant_admin','manager','staff');
CREATE TYPE public.subscription_plan AS ENUM ('starter','growth','business','premium');
CREATE TYPE public.subscription_status AS ENUM ('trial','active','suspended','cancelled');
CREATE TYPE public.registration_status AS ENUM ('pending','approved','rejected');

-- ============ TENANTS ============
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  business_type TEXT,
  phone TEXT,
  email TEXT,
  subscription_plan public.subscription_plan NOT NULL DEFAULT 'starter',
  subscription_status public.subscription_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES (separate table per security best practice) ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, tenant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ HELPER FUNCTIONS (security definer to bypass RLS recursion) ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'platform_super_admin')
$$;

CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id UUID, _tenant_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role AND tenant_id = _tenant_id)
$$;

-- ============ TENANT REGISTRATION REQUESTS ============
CREATE TABLE public.tenant_registration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  business_type TEXT,
  owner_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status public.registration_status NOT NULL DEFAULT 'approved',
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_registration_requests TO authenticated;
GRANT INSERT ON public.tenant_registration_requests TO anon;
GRANT ALL ON public.tenant_registration_requests TO service_role;
ALTER TABLE public.tenant_registration_requests ENABLE ROW LEVEL SECURITY;

-- ============ PLAN FEATURES ============
CREATE TABLE public.plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name public.subscription_plan NOT NULL,
  feature_key TEXT NOT NULL,
  UNIQUE (plan_name, feature_key)
);
GRANT SELECT ON public.plan_features TO authenticated, anon;
GRANT ALL ON public.plan_features TO service_role;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_features readable" ON public.plan_features FOR SELECT USING (true);

INSERT INTO public.plan_features (plan_name, feature_key) VALUES
  ('starter','sales'),('starter','expenses'),('starter','customers'),('starter','reports'),
  ('growth','sales'),('growth','expenses'),('growth','customers'),('growth','reports'),
  ('growth','inventory'),('growth','debtors'),('growth','suppliers'),('growth','stock_reports'),
  ('business','sales'),('business','expenses'),('business','customers'),('business','reports'),
  ('business','inventory'),('business','debtors'),('business','suppliers'),('business','stock_reports'),
  ('business','hr'),('business','payroll'),('business','assets'),('business','tasks'),
  ('premium','sales'),('premium','expenses'),('premium','customers'),('premium','reports'),
  ('premium','inventory'),('premium','debtors'),('premium','suppliers'),('premium','stock_reports'),
  ('premium','hr'),('premium','payroll'),('premium','assets'),('premium','tasks'),
  ('premium','mpesa'),('premium','sms'),('premium','whatsapp'),('premium','ai_assistant'),('premium','multi_branch');

CREATE OR REPLACE FUNCTION public.tenant_has_feature(_tenant_id UUID, _feature_key TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plan_features pf
    JOIN public.tenants t ON t.subscription_plan = pf.plan_name
    WHERE t.id = _tenant_id AND pf.feature_key = _feature_key
  )
$$;

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============ BUSINESS TABLES ============
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL, location TEXT, phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL, email TEXT, phone TEXT, address TEXT, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL, email TEXT, phone TEXT, address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL, sku TEXT, price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2) DEFAULT 0, stock_quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT, status TEXT DEFAULT 'completed', notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category TEXT NOT NULL, description TEXT, amount NUMERIC(12,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.debtors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  amount_owed NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE, status TEXT DEFAULT 'pending', notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL, email TEXT, phone TEXT,
  position TEXT, department TEXT, salary NUMERIC(12,2) DEFAULT 0,
  hire_date DATE, status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.payrolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  period TEXT NOT NULL, gross NUMERIC(12,2) NOT NULL DEFAULT 0,
  deductions NUMERIC(12,2) DEFAULT 0, net NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL, category TEXT, purchase_date DATE,
  cost NUMERIC(12,2) DEFAULT 0, location TEXT, status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT, assigned_to UUID REFERENCES auth.users(id),
  due_date DATE, status TEXT DEFAULT 'open', priority TEXT DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grants + RLS for business tables
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['branches','customers','suppliers','products','sales','expenses','debtors','employees','payrolls','assets','tasks'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($f$CREATE POLICY "tenant_select" ON public.%I FOR SELECT USING (tenant_id = public.get_my_tenant_id() OR public.is_platform_admin(auth.uid()))$f$, t);
    EXECUTE format($f$CREATE POLICY "tenant_insert" ON public.%I FOR INSERT WITH CHECK (tenant_id = public.get_my_tenant_id() OR public.is_platform_admin(auth.uid()))$f$, t);
    EXECUTE format($f$CREATE POLICY "tenant_update" ON public.%I FOR UPDATE USING (tenant_id = public.get_my_tenant_id() OR public.is_platform_admin(auth.uid()))$f$, t);
    EXECUTE format($f$CREATE POLICY "tenant_delete" ON public.%I FOR DELETE USING (tenant_id = public.get_my_tenant_id() OR public.is_platform_admin(auth.uid()))$f$, t);
  END LOOP;
END $$;

-- ============ POLICIES: tenants ============
CREATE POLICY "tenants_select_self_or_admin" ON public.tenants FOR SELECT
  USING (id = public.get_my_tenant_id() OR public.is_platform_admin(auth.uid()));
CREATE POLICY "tenants_update_admin_only" ON public.tenants FOR UPDATE
  USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(auth.uid(), id, 'tenant_admin'));
CREATE POLICY "tenants_insert_admin" ON public.tenants FOR INSERT
  WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "tenants_delete_admin" ON public.tenants FOR DELETE
  USING (public.is_platform_admin(auth.uid()));

-- ============ POLICIES: profiles ============
CREATE POLICY "profiles_select_own_tenant" ON public.profiles FOR SELECT
  USING (id = auth.uid() OR tenant_id = public.get_my_tenant_id() OR public.is_platform_admin(auth.uid()));
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid() OR public.is_platform_admin(auth.uid()));
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE
  USING (id = auth.uid() OR public.is_platform_admin(auth.uid())
    OR (tenant_id = public.get_my_tenant_id() AND public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')));
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE
  USING (public.is_platform_admin(auth.uid())
    OR (tenant_id = public.get_my_tenant_id() AND public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')));

-- ============ POLICIES: user_roles ============
CREATE POLICY "roles_select" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid())
    OR (tenant_id IS NOT NULL AND public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')));
CREATE POLICY "roles_insert" ON public.user_roles FOR INSERT
  WITH CHECK (public.is_platform_admin(auth.uid())
    OR (tenant_id IS NOT NULL AND public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')));
CREATE POLICY "roles_delete" ON public.user_roles FOR DELETE
  USING (public.is_platform_admin(auth.uid())
    OR (tenant_id IS NOT NULL AND public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')));

-- ============ POLICIES: tenant_registration_requests ============
CREATE POLICY "regreq_insert_anyone" ON public.tenant_registration_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "regreq_select_admin" ON public.tenant_registration_requests FOR SELECT
  USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "regreq_update_admin" ON public.tenant_registration_requests FOR UPDATE
  USING (public.is_platform_admin(auth.uid()));

-- ============ POLICIES: audit_logs ============
CREATE POLICY "audit_select_tenant_admin" ON public.audit_logs FOR SELECT
  USING (public.is_platform_admin(auth.uid())
    OR (tenant_id = public.get_my_tenant_id()
        AND public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')));
CREATE POLICY "audit_insert_any_auth" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id() OR public.is_platform_admin(auth.uid()));

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ATOMIC TENANT REGISTRATION (auto-approve) ============
-- Called by signed-in user immediately after signUp. Creates tenant + assigns tenant_admin role.
CREATE OR REPLACE FUNCTION public.register_tenant(
  _business_name TEXT, _business_type TEXT, _phone TEXT, _email TEXT, _owner_name TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _tenant_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  -- prevent attaching to another tenant
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND tenant_id IS NOT NULL) THEN
    RAISE EXCEPTION 'User already belongs to a tenant';
  END IF;

  INSERT INTO public.tenants (business_name, business_type, phone, email)
  VALUES (_business_name, _business_type, _phone, _email)
  RETURNING id INTO _tenant_id;

  UPDATE public.profiles
    SET tenant_id = _tenant_id, full_name = COALESCE(_owner_name, full_name)
    WHERE id = _uid;

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (_uid, 'tenant_admin', _tenant_id);

  INSERT INTO public.tenant_registration_requests
    (business_name, business_type, owner_name, email, phone, status, tenant_id)
  VALUES (_business_name, _business_type, _owner_name, _email, _phone, 'approved', _tenant_id);

  RETURN _tenant_id;
END $$;

GRANT EXECUTE ON FUNCTION public.register_tenant(TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;

-- ============ SUPER ADMIN BOOTSTRAP (first signup only) ============
CREATE OR REPLACE FUNCTION public.bootstrap_super_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'platform_super_admin') THEN
    RETURN FALSE;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'platform_super_admin');
  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION public.bootstrap_super_admin() TO authenticated;

-- ============ INVITE/ADD USER TO TENANT (tenant_admin only) ============
-- Assumes the invited user already has an auth account; tenant_admin attaches them.
CREATE OR REPLACE FUNCTION public.add_user_to_tenant(_email TEXT, _role public.app_role)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tid UUID := public.get_my_tenant_id(); _uid UUID;
BEGIN
  IF _tid IS NULL OR NOT public.has_tenant_role(auth.uid(), _tid, 'tenant_admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _role = 'platform_super_admin' THEN RAISE EXCEPTION 'Cannot assign platform role'; END IF;

  SELECT id INTO _uid FROM auth.users WHERE email = _email;
  IF _uid IS NULL THEN RAISE EXCEPTION 'No user with that email. Ask them to sign up first.'; END IF;

  UPDATE public.profiles SET tenant_id = _tid WHERE id = _uid AND tenant_id IS NULL;
  INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES (_uid, _role, _tid)
    ON CONFLICT DO NOTHING;
  RETURN _uid;
END $$;
GRANT EXECUTE ON FUNCTION public.add_user_to_tenant(TEXT, public.app_role) TO authenticated;
