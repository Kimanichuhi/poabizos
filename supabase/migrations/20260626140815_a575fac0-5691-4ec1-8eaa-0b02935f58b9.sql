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

  UPDATE public.tenants SET subscription_plan = _package_code, updated_at = now() WHERE id = _tid;
  RETURN _sub_id;
END $$;