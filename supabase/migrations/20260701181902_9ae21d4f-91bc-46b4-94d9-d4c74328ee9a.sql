
-- Policies use path prefix = tenant_id
CREATE POLICY "branding_read_own_tenant" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'tenant-branding'
    AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
  );

CREATE POLICY "branding_write_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-branding'
    AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
    AND public.has_tenant_role(auth.uid(), public.get_my_tenant_id(), 'tenant_admin')
  );

CREATE POLICY "branding_update_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tenant-branding'
    AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
    AND public.has_tenant_role(auth.uid(), public.get_my_tenant_id(), 'tenant_admin')
  );

CREATE POLICY "branding_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'tenant-branding'
    AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
    AND public.has_tenant_role(auth.uid(), public.get_my_tenant_id(), 'tenant_admin')
  );
