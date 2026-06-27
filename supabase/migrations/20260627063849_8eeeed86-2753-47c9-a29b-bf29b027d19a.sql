
CREATE OR REPLACE FUNCTION public.log_product_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _changed JSONB := '{}'::JSONB;
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN _changed := _changed || jsonb_build_object('name', jsonb_build_object('old', OLD.name, 'new', NEW.name)); END IF;
  IF NEW.sku IS DISTINCT FROM OLD.sku THEN _changed := _changed || jsonb_build_object('sku', jsonb_build_object('old', OLD.sku, 'new', NEW.sku)); END IF;
  IF NEW.cost IS DISTINCT FROM OLD.cost THEN _changed := _changed || jsonb_build_object('cost', jsonb_build_object('old', OLD.cost, 'new', NEW.cost)); END IF;
  IF NEW.price IS DISTINCT FROM OLD.price THEN _changed := _changed || jsonb_build_object('price', jsonb_build_object('old', OLD.price, 'new', NEW.price)); END IF;
  IF NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity THEN _changed := _changed || jsonb_build_object('stock_quantity', jsonb_build_object('old', OLD.stock_quantity, 'new', NEW.stock_quantity)); END IF;
  IF NEW.reorder_level IS DISTINCT FROM OLD.reorder_level THEN _changed := _changed || jsonb_build_object('reorder_level', jsonb_build_object('old', OLD.reorder_level, 'new', NEW.reorder_level)); END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN _changed := _changed || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status)); END IF;
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN _changed := _changed || jsonb_build_object('archived_at', jsonb_build_object('old', OLD.archived_at, 'new', NEW.archived_at)); END IF;
  IF _changed = '{}'::JSONB THEN RETURN NEW; END IF;
  INSERT INTO public.audit_logs (tenant_id, user_id, action, table_name, record_id, metadata)
  VALUES (NEW.tenant_id, auth.uid(), 'product.update', 'products', NEW.id, _changed);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_product_change ON public.products;
CREATE TRIGGER trg_log_product_change AFTER UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_product_change();

CREATE OR REPLACE FUNCTION public.log_stock_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs (tenant_id, user_id, action, table_name, record_id, metadata)
  VALUES (
    NEW.tenant_id, COALESCE(NEW.created_by, auth.uid()),
    'stock.' || COALESCE(NEW.reference_type, 'movement'),
    'stock_movements', NEW.id,
    jsonb_build_object('product_id', NEW.product_id, 'change', NEW.change, 'reason', NEW.reason, 'reference_type', NEW.reference_type, 'reference_id', NEW.reference_id, 'notes', NEW.notes)
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_stock_movement ON public.stock_movements;
CREATE TRIGGER trg_log_stock_movement AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.log_stock_movement();
