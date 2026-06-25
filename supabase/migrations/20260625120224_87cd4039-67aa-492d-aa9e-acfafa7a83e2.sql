
-- ============= Products: enrich =============
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_service BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ============= Sales: enrich =============
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS sale_type TEXT NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_received NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ============= Expenses: enrich =============
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS vendor_name TEXT,
  ADD COLUMN IF NOT EXISTS vendor_phone TEXT,
  ADD COLUMN IF NOT EXISTS vendor_email TEXT,
  ADD COLUMN IF NOT EXISTS receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS recurrence TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ============= Sale items =============
CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_service BOOLEAN NOT NULL DEFAULT false,
  staff_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read sale_items" ON public.sale_items FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id() OR public.is_platform_admin(auth.uid()));
CREATE POLICY "tenant write sale_items" ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY "tenant update sale_items" ON public.sale_items FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY "tenant delete sale_items" ON public.sale_items FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_tenant ON public.sale_items(tenant_id);

-- ============= Stock movements =============
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  change NUMERIC(14,3) NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read stock_movements" ON public.stock_movements FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id() OR public.is_platform_admin(auth.uid()));
CREATE POLICY "tenant insert stock_movements" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);

-- ============= Product categories =============
CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant rw product_categories" ON public.product_categories FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ============= Expense categories =============
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant rw expense_categories" ON public.expense_categories FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ============= RPC: record_sale (atomic) =============
CREATE OR REPLACE FUNCTION public.record_sale(_payload JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tid UUID := public.get_my_tenant_id();
  _uid UUID := auth.uid();
  _sale_id UUID;
  _item JSONB;
  _subtotal NUMERIC(14,2) := 0;
  _discount NUMERIC(14,2) := COALESCE((_payload->>'discount')::NUMERIC, 0);
  _tax NUMERIC(14,2) := COALESCE((_payload->>'tax')::NUMERIC, 0);
  _amount_received NUMERIC(14,2) := COALESCE((_payload->>'amount_received')::NUMERIC, 0);
  _total NUMERIC(14,2);
  _balance NUMERIC(14,2);
  _sale_type TEXT := COALESCE(_payload->>'sale_type', 'cash');
  _customer_id UUID := NULLIF(_payload->>'customer_id','')::UUID;
  _pid UUID;
  _qty NUMERIC(14,3);
  _unit NUMERIC(14,2);
  _ldisc NUMERIC(14,2);
  _line NUMERIC(14,2);
  _is_service BOOLEAN;
  _stock NUMERIC(14,3);
BEGIN
  IF _tid IS NULL THEN RAISE EXCEPTION 'No tenant'; END IF;
  IF jsonb_array_length(_payload->'items') = 0 THEN RAISE EXCEPTION 'No items'; END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_payload->'items') LOOP
    _qty := COALESCE((_item->>'quantity')::NUMERIC, 0);
    _unit := COALESCE((_item->>'unit_price')::NUMERIC, 0);
    _ldisc := COALESCE((_item->>'discount')::NUMERIC, 0);
    _line := (_qty * _unit) - _ldisc;
    _subtotal := _subtotal + _line;
  END LOOP;

  _total := _subtotal - _discount + _tax;
  _balance := _total - _amount_received;

  INSERT INTO public.sales (
    tenant_id, customer_id, customer_name, customer_phone,
    total_amount, subtotal, discount, tax, amount_received, balance,
    payment_method, sale_type, sale_date, status, notes, created_by
  ) VALUES (
    _tid, _customer_id, _payload->>'customer_name', _payload->>'customer_phone',
    _total, _subtotal, _discount, _tax, _amount_received, _balance,
    COALESCE(_payload->>'payment_method', _sale_type), _sale_type,
    COALESCE((_payload->>'sale_date')::DATE, CURRENT_DATE),
    CASE WHEN _sale_type = 'credit' AND _balance > 0 THEN 'pending' ELSE 'completed' END,
    _payload->>'notes', _uid
  ) RETURNING id INTO _sale_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_payload->'items') LOOP
    _pid := NULLIF(_item->>'product_id','')::UUID;
    _qty := COALESCE((_item->>'quantity')::NUMERIC, 0);
    _unit := COALESCE((_item->>'unit_price')::NUMERIC, 0);
    _ldisc := COALESCE((_item->>'discount')::NUMERIC, 0);
    _line := (_qty * _unit) - _ldisc;
    _is_service := COALESCE((_item->>'is_service')::BOOLEAN, false);

    INSERT INTO public.sale_items (
      tenant_id, sale_id, product_id, description, quantity, unit_price, discount, line_total, is_service, staff_id, notes
    ) VALUES (
      _tid, _sale_id, _pid, COALESCE(_item->>'description','Item'), _qty, _unit, _ldisc, _line, _is_service,
      NULLIF(_item->>'staff_id','')::UUID, _item->>'notes'
    );

    -- Decrement stock for tangible products with a product_id
    IF _pid IS NOT NULL AND NOT _is_service THEN
      UPDATE public.products
        SET stock_quantity = stock_quantity - _qty::INT,
            updated_at = now()
        WHERE id = _pid AND tenant_id = _tid
        RETURNING stock_quantity INTO _stock;
      INSERT INTO public.stock_movements (tenant_id, product_id, change, reason, reference_type, reference_id, created_by)
        VALUES (_tid, _pid, -_qty, 'sale', 'sale', _sale_id, _uid);
    END IF;
  END LOOP;

  -- Credit sale: create debtor entry
  IF _sale_type = 'credit' AND _balance > 0 AND _customer_id IS NOT NULL THEN
    INSERT INTO public.debtors (tenant_id, customer_id, amount_owed, due_date, status, notes)
    VALUES (_tid, _customer_id, _balance,
      COALESCE((_payload->>'due_date')::DATE, CURRENT_DATE + INTERVAL '30 days'),
      'open', 'Auto-created from sale');
  END IF;

  RETURN _sale_id;
END $$;

-- ============= RPC: adjust_stock =============
CREATE OR REPLACE FUNCTION public.adjust_stock(_product_id UUID, _change NUMERIC, _reason TEXT, _notes TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _tid UUID := public.get_my_tenant_id();
BEGIN
  IF _tid IS NULL THEN RAISE EXCEPTION 'No tenant'; END IF;
  UPDATE public.products SET stock_quantity = stock_quantity + _change::INT, updated_at = now()
    WHERE id = _product_id AND tenant_id = _tid;
  INSERT INTO public.stock_movements (tenant_id, product_id, change, reason, notes, reference_type, created_by)
    VALUES (_tid, _product_id, _change, _reason, _notes, 'adjustment', auth.uid());
END $$;
