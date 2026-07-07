
CREATE OR REPLACE FUNCTION public.admin_broadcast_notification(
  _title TEXT, _body TEXT, _tenant_ids UUID[] DEFAULT NULL
) RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count INT := 0;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _title IS NULL OR length(trim(_title)) = 0 THEN RAISE EXCEPTION 'Title required'; END IF;
  IF _tenant_ids IS NULL OR array_length(_tenant_ids, 1) IS NULL THEN
    INSERT INTO public.notifications (tenant_id, kind, title, body, metadata)
    SELECT id, 'broadcast', _title, _body, jsonb_build_object('scope','all') FROM public.tenants;
    GET DIAGNOSTICS _count = ROW_COUNT;
  ELSE
    INSERT INTO public.notifications (tenant_id, kind, title, body, metadata)
    SELECT unnest(_tenant_ids), 'broadcast', _title, _body, jsonb_build_object('scope','targeted');
    GET DIAGNOSTICS _count = ROW_COUNT;
  END IF;
  INSERT INTO public.audit_logs (user_id, action, table_name, metadata)
  VALUES (auth.uid(), 'admin.broadcast_sent', 'notifications',
          jsonb_build_object('title', _title, 'delivered', _count,
                             'tenant_ids', COALESCE(_tenant_ids, ARRAY[]::UUID[])));
  RETURN _count;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_broadcasts()
RETURNS TABLE (created_at TIMESTAMPTZ, title TEXT, body TEXT, tenant_count BIGINT, read_count BIGINT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT date_trunc('second', n.created_at), n.title, n.body,
         count(*)::BIGINT, count(*) FILTER (WHERE n.read_at IS NOT NULL)::BIGINT
  FROM public.notifications n
  WHERE n.kind = 'broadcast' AND public.is_platform_admin(auth.uid())
  GROUP BY 1,2,3 ORDER BY 1 DESC LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.admin_broadcast_delivery(_created_at TIMESTAMPTZ, _title TEXT)
RETURNS TABLE (tenant_id UUID, business_name TEXT, delivered_at TIMESTAMPTZ, read_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT n.tenant_id, t.business_name, n.created_at, n.read_at
  FROM public.notifications n JOIN public.tenants t ON t.id = n.tenant_id
  WHERE n.kind = 'broadcast' AND n.title = _title
    AND date_trunc('second', n.created_at) = date_trunc('second', _created_at)
    AND public.is_platform_admin(auth.uid())
  ORDER BY t.business_name;
$$;

GRANT EXECUTE ON FUNCTION public.admin_broadcast_notification(TEXT, TEXT, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_broadcasts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_broadcast_delivery(TIMESTAMPTZ, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_change_tenant_package(_tenant_id UUID, _package_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid UUID; _sub_id UUID;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT id INTO _pid FROM public.subscription_packages WHERE package_code = _package_code AND is_active = TRUE;
  IF _pid IS NULL THEN RAISE EXCEPTION 'Unknown package'; END IF;
  UPDATE public.tenant_subscriptions SET status = 'cancelled', updated_at = now()
    WHERE tenant_id = _tenant_id AND status IN ('active','trial');
  INSERT INTO public.tenant_subscriptions (tenant_id, package_id, start_date, status)
    VALUES (_tenant_id, _pid, CURRENT_DATE, 'active') RETURNING id INTO _sub_id;
  UPDATE public.tenants SET subscription_plan = _package_code::public.subscription_plan, updated_at = now()
    WHERE id = _tenant_id;
  INSERT INTO public.notifications (tenant_id, kind, title, body, metadata)
  VALUES (_tenant_id, 'subscription.package_changed', 'Your subscription package changed',
          'Your workspace is now on the ' || _package_code || ' package.',
          jsonb_build_object('package_code', _package_code));
  INSERT INTO public.audit_logs (tenant_id, user_id, action, table_name, record_id, metadata)
  VALUES (_tenant_id, auth.uid(), 'admin.package_changed', 'tenant_subscriptions', _sub_id::TEXT,
          jsonb_build_object('package_code', _package_code));
  RETURN _sub_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_tenant_status(_tenant_id UUID, _status TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _status NOT IN ('trial','active','suspended','cancelled') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE public.tenants SET subscription_status = _status::public.sub_status, updated_at = now()
    WHERE id = _tenant_id;
  INSERT INTO public.notifications (tenant_id, kind, title, body, metadata)
  VALUES (_tenant_id, 'subscription.status_changed', 'Subscription status updated',
          'Your subscription is now ' || _status || '.', jsonb_build_object('status', _status));
  INSERT INTO public.audit_logs (tenant_id, user_id, action, table_name, record_id, metadata)
  VALUES (_tenant_id, auth.uid(), 'admin.status_changed', 'tenants', _tenant_id::TEXT,
          jsonb_build_object('status', _status));
END $$;

CREATE OR REPLACE FUNCTION public.log_ai_turn(
  _tenant_id UUID, _thread_id UUID, _role TEXT, _length INT,
  _model TEXT DEFAULT NULL, _status TEXT DEFAULT 'ok'
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs (tenant_id, user_id, action, table_name, record_id, metadata)
  VALUES (_tenant_id, auth.uid(), 'ai.turn.' || _role, 'ai_chat_messages', _thread_id::TEXT,
          jsonb_build_object('length', _length, 'model', _model, 'status', _status));
END $$;

GRANT EXECUTE ON FUNCTION public.log_ai_turn(UUID, UUID, TEXT, INT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_ui_content_audit(_key TEXT, _broadcast BOOLEAN) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, metadata)
  VALUES (auth.uid(), 'admin.ui_content_saved', 'ui_content', _key,
          jsonb_build_object('broadcast', _broadcast));
END $$;
GRANT EXECUTE ON FUNCTION public.admin_upsert_ui_content_audit(TEXT, BOOLEAN) TO authenticated;
