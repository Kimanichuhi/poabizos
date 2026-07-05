
CREATE OR REPLACE FUNCTION public.admin_set_tenant_status(_tenant_id UUID, _status TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _status NOT IN ('trial','active','suspended','cancelled') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE public.tenants SET subscription_status = _status::public.subscription_status, updated_at = now()
    WHERE id = _tenant_id;
  INSERT INTO public.notifications (tenant_id, kind, title, body, metadata)
  VALUES (_tenant_id, 'subscription.status_changed',
          'Subscription status updated',
          'Your subscription is now ' || _status || '.',
          jsonb_build_object('status', _status));
END $$;
