
-- 1. Fix mutable search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- 2. Lock down EXECUTE on all public SECURITY DEFINER functions;
--    grant back only to `authenticated` for RPCs the app actually calls.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- App RPCs called by signed-in users
GRANT EXECUTE ON FUNCTION public.bootstrap_super_admin()                                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_tenant(text,text,text,text,text)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_tenant_package(text)                                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_settings(jsonb)                                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid,numeric,text,text)                             TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_sale(jsonb)                                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_product_by_barcode(text)                                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.product_profit_history(uuid,date,date)                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_user_to_tenant(text,app_role)                                TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_tenant_user(uuid)                                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_tenant_user_role(uuid,app_role)                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid,uuid,app_role)                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,app_role)                                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid)                                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_tenant_id()                                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_has_feature(uuid,text)                                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_features(uuid)                                        TO authenticated;
-- handle_new_user, log_product_change, log_stock_movement, touch_updated_at are trigger functions and need no grants.

-- 3. Restrict employees UPDATE/DELETE to tenant_admin (consistent with INSERT)
DROP POLICY IF EXISTS tenant_update ON public.employees;
DROP POLICY IF EXISTS tenant_delete ON public.employees;
CREATE POLICY employees_update_admin_only ON public.employees FOR UPDATE
  USING ((tenant_id = get_my_tenant_id()) AND (has_tenant_role(auth.uid(), tenant_id, 'tenant_admin') OR is_platform_admin(auth.uid())))
  WITH CHECK ((tenant_id = get_my_tenant_id()) AND (has_tenant_role(auth.uid(), tenant_id, 'tenant_admin') OR is_platform_admin(auth.uid())));
CREATE POLICY employees_delete_admin_only ON public.employees FOR DELETE
  USING ((tenant_id = get_my_tenant_id()) AND (has_tenant_role(auth.uid(), tenant_id, 'tenant_admin') OR is_platform_admin(auth.uid())));

-- 4. Restrict payrolls writes to tenant_admin
DROP POLICY IF EXISTS tenant_insert ON public.payrolls;
DROP POLICY IF EXISTS tenant_update ON public.payrolls;
DROP POLICY IF EXISTS tenant_delete ON public.payrolls;
CREATE POLICY payrolls_insert_admin_only ON public.payrolls FOR INSERT
  WITH CHECK ((tenant_id = get_my_tenant_id()) AND (has_tenant_role(auth.uid(), tenant_id, 'tenant_admin') OR is_platform_admin(auth.uid())));
CREATE POLICY payrolls_update_admin_only ON public.payrolls FOR UPDATE
  USING ((tenant_id = get_my_tenant_id()) AND (has_tenant_role(auth.uid(), tenant_id, 'tenant_admin') OR is_platform_admin(auth.uid())))
  WITH CHECK ((tenant_id = get_my_tenant_id()) AND (has_tenant_role(auth.uid(), tenant_id, 'tenant_admin') OR is_platform_admin(auth.uid())));
CREATE POLICY payrolls_delete_admin_only ON public.payrolls FOR DELETE
  USING ((tenant_id = get_my_tenant_id()) AND (has_tenant_role(auth.uid(), tenant_id, 'tenant_admin') OR is_platform_admin(auth.uid())));

-- 5. Restrict sale_items DELETE to tenant_admin (voiding a sale is a privileged op)
DROP POLICY IF EXISTS "tenant delete sale_items" ON public.sale_items;
CREATE POLICY sale_items_delete_admin_only ON public.sale_items FOR DELETE
  USING ((tenant_id = get_my_tenant_id()) AND (has_tenant_role(auth.uid(), tenant_id, 'tenant_admin') OR is_platform_admin(auth.uid())));

-- 6. Tighten public registration policy — require the caller to provide the required
--    identifying fields and forbid pre-approving themselves or attaching to an existing tenant.
DROP POLICY IF EXISTS regreq_insert_anyone ON public.tenant_registration_requests;
CREATE POLICY regreq_insert_public ON public.tenant_registration_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    business_name IS NOT NULL AND length(btrim(business_name)) > 0
    AND owner_name    IS NOT NULL AND length(btrim(owner_name))    > 0
    AND email         IS NOT NULL AND length(btrim(email))         > 0
    AND status = 'pending'::registration_status
    AND tenant_id IS NULL
  );
