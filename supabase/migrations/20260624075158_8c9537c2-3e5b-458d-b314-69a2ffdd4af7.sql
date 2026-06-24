
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_tenant_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_tenant_role(UUID, UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tenant_has_feature(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.register_tenant(TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bootstrap_super_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_user_to_tenant(TEXT, public.app_role) FROM PUBLIC, anon;
