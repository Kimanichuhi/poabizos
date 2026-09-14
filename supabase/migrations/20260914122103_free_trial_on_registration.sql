-- ============================================================
-- Give every newly registered tenant a 30-day free trial instead
-- of an immediately-active paid subscription.
-- ============================================================

-- 1. register_tenant: create the tenant on 'trial' status and record a
--    matching tenant_subscriptions row (Starter features, 30 days) so both
--    the modern (tenant_subscriptions) and legacy (tenants.subscription_*)
--    feature-gating paths agree from day one.
CREATE OR REPLACE FUNCTION public.register_tenant(
  _business_name TEXT, _business_type TEXT, _phone TEXT, _email TEXT, _owner_name TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _tenant_id UUID;
  _starter_package_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND tenant_id IS NOT NULL) THEN
    RAISE EXCEPTION 'User already belongs to a tenant';
  END IF;

  INSERT INTO public.tenants (business_name, business_type, phone, email, subscription_plan, subscription_status)
  VALUES (_business_name, _business_type, _phone, _email, 'starter', 'trial')
  RETURNING id INTO _tenant_id;

  UPDATE public.profiles
    SET tenant_id = _tenant_id, full_name = COALESCE(_owner_name, full_name)
    WHERE id = _uid;

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (_uid, 'tenant_admin', _tenant_id);

  INSERT INTO public.tenant_registration_requests
    (business_name, business_type, owner_name, email, phone, status, tenant_id)
  VALUES (_business_name, _business_type, _owner_name, _email, _phone, 'approved', _tenant_id);

  SELECT id INTO _starter_package_id FROM public.subscription_packages WHERE package_code = 'starter';
  IF _starter_package_id IS NOT NULL THEN
    INSERT INTO public.tenant_subscriptions (tenant_id, package_id, start_date, expiry_date, status)
    VALUES (_tenant_id, _starter_package_id, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'trial');
  END IF;

  RETURN _tenant_id;
END $$;

-- 2. tenant_has_feature / get_tenant_features: a 'trial' tenant_subscriptions
--    row only grants access while it hasn't passed its expiry_date. 'active'
--    rows (real paid subscriptions) are unaffected — they have no expiry.
CREATE OR REPLACE FUNCTION public.tenant_has_feature(_tenant_id uuid, _feature_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_subscriptions ts
    JOIN public.package_features pf ON pf.package_id = ts.package_id
    JOIN public.features f ON f.id = pf.feature_id
    WHERE ts.tenant_id = _tenant_id
      AND (ts.status = 'active' OR (ts.status = 'trial' AND (ts.expiry_date IS NULL OR ts.expiry_date >= CURRENT_DATE)))
      AND f.feature_key = _feature_key
  ) OR EXISTS (
    -- fallback to legacy tenants.subscription_plan if no tenant_subscription row
    SELECT 1
    FROM public.tenants t
    JOIN public.subscription_packages sp ON sp.package_code = t.subscription_plan::text
    JOIN public.package_features pf ON pf.package_id = sp.id
    JOIN public.features f ON f.id = pf.feature_id
    WHERE t.id = _tenant_id AND f.feature_key = _feature_key
      AND NOT EXISTS (SELECT 1 FROM public.tenant_subscriptions x WHERE x.tenant_id = t.id)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_features(_tenant_id uuid)
RETURNS TABLE(feature_key text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT f.feature_key
  FROM public.tenant_subscriptions ts
  JOIN public.package_features pf ON pf.package_id = ts.package_id
  JOIN public.features f ON f.id = pf.feature_id
  WHERE ts.tenant_id = _tenant_id
    AND (ts.status = 'active' OR (ts.status = 'trial' AND (ts.expiry_date IS NULL OR ts.expiry_date >= CURRENT_DATE)))
  UNION
  SELECT DISTINCT f.feature_key
  FROM public.tenants t
  JOIN public.subscription_packages sp ON sp.package_code = t.subscription_plan::text
  JOIN public.package_features pf ON pf.package_id = sp.id
  JOIN public.features f ON f.id = pf.feature_id
  WHERE t.id = _tenant_id
    AND NOT EXISTS (SELECT 1 FROM public.tenant_subscriptions x WHERE x.tenant_id = t.id);
$$;
