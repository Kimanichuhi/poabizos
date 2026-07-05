
-- ============================================================================
-- AI chat threads/messages, notifications, ui_content, admin RPCs
-- ============================================================================

-- ---------- AI chat threads ----------
CREATE TABLE public.ai_chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_chat_threads_tenant_user ON public.ai_chat_threads(tenant_id, user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_chat_threads TO authenticated;
GRANT ALL ON public.ai_chat_threads TO service_role;
ALTER TABLE public.ai_chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own AI threads" ON public.ai_chat_threads
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND tenant_id = public.get_my_tenant_id())
  WITH CHECK (user_id = auth.uid() AND tenant_id = public.get_my_tenant_id());

CREATE TRIGGER trg_ai_chat_threads_touch
  BEFORE UPDATE ON public.ai_chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- AI chat messages ----------
CREATE TABLE public.ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.ai_chat_threads(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_chat_messages_thread ON public.ai_chat_messages(thread_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_chat_messages TO authenticated;
GRANT ALL ON public.ai_chat_messages TO service_role;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own AI messages" ON public.ai_chat_messages
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND tenant_id = public.get_my_tenant_id())
  WITH CHECK (user_id = auth.uid() AND tenant_id = public.get_my_tenant_id());

-- bump thread updated_at when a new message arrives
CREATE OR REPLACE FUNCTION public.bump_thread_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.ai_chat_threads SET updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_ai_chat_messages_bump
  AFTER INSERT ON public.ai_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_thread_updated_at();

-- ---------- Notifications ----------
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_tenant ON public.notifications(tenant_id, created_at DESC);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their tenant/user notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND tenant_id = public.get_my_tenant_id())
  );
CREATE POLICY "Users mark their notifications read" ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND tenant_id = public.get_my_tenant_id())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (user_id IS NULL AND tenant_id = public.get_my_tenant_id())
  );

-- ---------- UI content (editable landing/marketing copy) ----------
CREATE TABLE public.ui_content (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
GRANT SELECT ON public.ui_content TO anon, authenticated;
GRANT ALL ON public.ui_content TO service_role;
ALTER TABLE public.ui_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read ui_content" ON public.ui_content
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Platform admins manage ui_content" ON public.ui_content
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

INSERT INTO public.ui_content (key, value) VALUES
  ('hero_title', '"Run your whole business from one place"'::JSONB),
  ('hero_subtitle', '"Sales, inventory, expenses, staff, and reports — designed for growing businesses."'::JSONB),
  ('announcement', '""'::JSONB)
ON CONFLICT (key) DO NOTHING;

-- ---------- Admin RPCs ----------
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
  VALUES (_tenant_id, 'subscription.package_changed',
          'Your subscription package changed',
          'Your workspace is now on the ' || _package_code || ' package.',
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
  VALUES (_tenant_id, 'subscription.status_changed',
          'Subscription status updated',
          'Your subscription is now ' || _status || '.',
          jsonb_build_object('status', _status));
END $$;

CREATE OR REPLACE FUNCTION public.admin_upsert_package(_payload JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  _id := NULLIF(_payload->>'id','')::UUID;
  IF _id IS NULL THEN
    INSERT INTO public.subscription_packages (package_code, package_name, monthly_price, user_limit, description, is_active, sort_order)
    VALUES (_payload->>'package_code', _payload->>'package_name',
            COALESCE((_payload->>'monthly_price')::NUMERIC, 0),
            NULLIF(_payload->>'user_limit','')::INT,
            _payload->>'description',
            COALESCE((_payload->>'is_active')::BOOLEAN, TRUE),
            COALESCE((_payload->>'sort_order')::INT, 100))
    RETURNING id INTO _id;
  ELSE
    UPDATE public.subscription_packages SET
      package_name = COALESCE(_payload->>'package_name', package_name),
      monthly_price = COALESCE((_payload->>'monthly_price')::NUMERIC, monthly_price),
      user_limit = CASE WHEN _payload ? 'user_limit' THEN NULLIF(_payload->>'user_limit','')::INT ELSE user_limit END,
      description = COALESCE(_payload->>'description', description),
      is_active = COALESCE((_payload->>'is_active')::BOOLEAN, is_active),
      sort_order = COALESCE((_payload->>'sort_order')::INT, sort_order)
    WHERE id = _id;
  END IF;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_package_features(_package_id UUID, _feature_keys TEXT[])
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _fid UUID; _key TEXT;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  DELETE FROM public.package_features WHERE package_id = _package_id;
  FOREACH _key IN ARRAY _feature_keys LOOP
    SELECT id INTO _fid FROM public.features WHERE feature_key = _key;
    IF _fid IS NOT NULL THEN
      INSERT INTO public.package_features (package_id, feature_id) VALUES (_package_id, _fid)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  -- Notify all tenants on this package that features changed
  INSERT INTO public.notifications (tenant_id, kind, title, body, metadata)
  SELECT DISTINCT ts.tenant_id, 'package.features_changed', 'Your plan features were updated',
         'The features included in your package changed. Refresh to see updates.',
         jsonb_build_object('package_id', _package_id)
  FROM public.tenant_subscriptions ts
  WHERE ts.package_id = _package_id AND ts.status IN ('active','trial');
END $$;

CREATE OR REPLACE FUNCTION public.admin_upsert_ui_content(_key TEXT, _value JSONB, _broadcast BOOLEAN DEFAULT FALSE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  INSERT INTO public.ui_content (key, value, updated_at, updated_by)
    VALUES (_key, _value, now(), auth.uid())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = auth.uid();
  IF _broadcast THEN
    INSERT INTO public.notifications (tenant_id, kind, title, body, metadata)
    SELECT id, 'platform.announcement', 'Announcement from PoaBiz OS',
           COALESCE(_value::TEXT, ''), jsonb_build_object('key', _key)
    FROM public.tenants;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.mark_notifications_read(_ids UUID[])
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.notifications SET read_at = now()
  WHERE id = ANY(_ids)
    AND (user_id = auth.uid() OR (user_id IS NULL AND tenant_id = public.get_my_tenant_id()));
END $$;

-- Enable Realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
