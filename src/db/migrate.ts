import { db, pool } from "./index";
import { sql } from "drizzle-orm";

/**
 * Creates all database tables if they don't exist.
 * This replaces drizzle-kit push for production on Render.com
 */
export async function migrateDatabase() {
  console.log("Running database migration...");

  await db.execute(sql`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE IF NOT EXISTS system_settings (
      id TEXT PRIMARY KEY,
      business_name TEXT,
      tax_number TEXT,
      currency TEXT DEFAULT 'تومان',
      number_format TEXT DEFAULT 'fa-IR',
      pricing_rule TEXT DEFAULT 'tiered_margin',
      health_green_threshold INTEGER DEFAULT 75,
      health_yellow_threshold INTEGER DEFAULT 50,
      map_provider TEXT DEFAULT 'neshan',
      ai_enabled BOOLEAN DEFAULT true,
      openai_api_key TEXT,
      openai_model TEXT DEFAULT 'gemini-2.5-flash',
      auto_backup_interval_hours INTEGER DEFAULT 24,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    -- Keep existing Render/production databases in sync with the current schema.
    -- CREATE TABLE IF NOT EXISTS does not add columns to an already-existing table.
    ALTER TABLE system_settings
      ADD COLUMN IF NOT EXISTS auto_backup_interval_hours INTEGER DEFAULT 24;

    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      label TEXT,
      description TEXT,
      icon TEXT DEFAULT 'folder',
      color TEXT DEFAULT '#3b82f6',
      status TEXT DEFAULT 'active' NOT NULL,
      start_date TIMESTAMP,
      end_date TIMESTAMP,
      pricing_settings JSONB DEFAULT '{"defaultMarginPercent": 25}',
      commission_settings JSONB DEFAULT '{"defaultRatePercent": 5}',
      accounting_settings JSONB DEFAULT '{"taxEnabled": false, "defaultTaxRate": 10}',
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      store_name TEXT,
      mobile TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      city TEXT DEFAULT 'تهران',
      region TEXT,
      postal_code TEXT,
      latitude NUMERIC(10,6) DEFAULT 35.6892,
      longitude NUMERIC(10,6) DEFAULT 51.3890,
      payment_terms_days INTEGER DEFAULT 30,
      credit_limit NUMERIC(15,2) DEFAULT 0,
      assigned_employee_id UUID,
      status TEXT DEFAULT 'active' NOT NULL,
      health_score INTEGER DEFAULT 85 NOT NULL,
      health_status TEXT DEFAULT 'green' NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customer_project_memberships (
      customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP DEFAULT NOW() NOT NULL,
      PRIMARY KEY (customer_id, project_id)
    );

    CREATE TABLE IF NOT EXISTS customer_health_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      previous_score INTEGER NOT NULL,
      new_score INTEGER NOT NULL,
      previous_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      breakdown JSONB NOT NULL,
      reason TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS employees (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      role TEXT DEFAULT 'visitor' NOT NULL,
      status TEXT DEFAULT 'active' NOT NULL,
      base_salary NUMERIC(15,2) DEFAULT 0,
      commission_rate_percent NUMERIC(5,2) DEFAULT 5,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS employee_project_memberships (
      employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP DEFAULT NOW() NOT NULL,
      PRIMARY KEY (employee_id, project_id)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      contact_person TEXT,
      mobile TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS raw_materials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      unit TEXT DEFAULT 'کیلوگرم' NOT NULL,
      unit_conversion_factor NUMERIC(10,4) DEFAULT 1,
      secondary_unit TEXT,
      stock_quantity NUMERIC(15,4) DEFAULT 0,
      min_stock_quantity NUMERIC(15,4) DEFAULT 10,
      current_cost NUMERIC(15,2) DEFAULT 0,
      average_cost NUMERIC(15,2) DEFAULT 0,
      cost_policy TEXT DEFAULT 'average',
      supplier_id UUID REFERENCES suppliers(id),
      status TEXT DEFAULT 'active' NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS raw_material_price_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
      previous_cost NUMERIC(15,2) NOT NULL,
      new_cost NUMERIC(15,2) NOT NULL,
      change_reason TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'عمومی',
      unit TEXT DEFAULT 'عدد',
      base_price NUMERIC(15,2) DEFAULT 0,
      calculated_cost NUMERIC(15,2) DEFAULT 0,
      stock_quantity NUMERIC(15,4) DEFAULT 0,
      min_stock_quantity NUMERIC(15,4) DEFAULT 5,
      status TEXT DEFAULT 'active' NOT NULL,
      is_special BOOLEAN DEFAULT false NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_recipes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
      quantity_required NUMERIC(15,4) NOT NULL,
      wastage_percent NUMERIC(5,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_product_prices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      custom_price NUMERIC(15,2),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
      UNIQUE(project_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'central',
      is_default BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_ledger (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      warehouse_id UUID REFERENCES warehouses(id),
      item_type TEXT NOT NULL,
      item_id UUID NOT NULL,
      transaction_type TEXT NOT NULL,
      quantity_change NUMERIC(15,4) NOT NULL,
      quantity_before NUMERIC(15,4) NOT NULL,
      quantity_after NUMERIC(15,4) NOT NULL,
      unit_cost_snapshot NUMERIC(15,2),
      total_cost_snapshot NUMERIC(15,2),
      reference_type TEXT,
      reference_id UUID,
      project_id UUID,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      purchase_number TEXT NOT NULL UNIQUE,
      supplier_id UUID NOT NULL REFERENCES suppliers(id),
      project_id UUID REFERENCES projects(id),
      subtotal NUMERIC(15,2) DEFAULT 0,
      grand_total NUMERIC(15,2) DEFAULT 0,
      paid_amount NUMERIC(15,2) DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      item_type TEXT DEFAULT 'raw_material',
      item_id UUID NOT NULL,
      quantity NUMERIC(15,4) NOT NULL,
      unit TEXT DEFAULT 'عدد',
      unit_cost NUMERIC(15,2) NOT NULL,
      total_cost NUMERIC(15,2) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS production_batches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_number TEXT NOT NULL UNIQUE,
      product_id UUID NOT NULL REFERENCES products(id),
      project_id UUID REFERENCES projects(id),
      quantity_produced NUMERIC(15,4) NOT NULL,
      total_batch_cost NUMERIC(15,2) DEFAULT 0,
      unit_cost NUMERIC(15,2) DEFAULT 0,
      labor_cost NUMERIC(15,2) DEFAULT 0,
      overhead_cost NUMERIC(15,2) DEFAULT 0,
      packaging_cost NUMERIC(15,2) DEFAULT 0,
      status TEXT DEFAULT 'completed',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS production_batch_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
      raw_material_id UUID NOT NULL REFERENCES raw_materials(id),
      quantity_used NUMERIC(15,4) NOT NULL,
      unit_cost_snapshot NUMERIC(15,2) NOT NULL,
      total_cost NUMERIC(15,2) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_number TEXT NOT NULL UNIQUE,
      customer_id UUID NOT NULL REFERENCES customers(id),
      project_id UUID REFERENCES projects(id),
      sales_mode TEXT DEFAULT 'direct',
      employee_id UUID REFERENCES employees(id),
      intermediary_employee_id UUID REFERENCES employees(id),
      invoice_date TIMESTAMP DEFAULT NOW() NOT NULL,
      due_date TIMESTAMP,
      subtotal NUMERIC(15,2) DEFAULT 0,
      line_discounts_total NUMERIC(15,2) DEFAULT 0,
      invoice_discount NUMERIC(15,2) DEFAULT 0,
      tax_total NUMERIC(15,2) DEFAULT 0,
      grand_total NUMERIC(15,2) DEFAULT 0,
      cogs_total NUMERIC(15,2) DEFAULT 0,
      gross_profit_total NUMERIC(15,2) DEFAULT 0,
      paid_amount NUMERIC(15,2) DEFAULT 0,
      balance_due NUMERIC(15,2) DEFAULT 0,
      payment_status TEXT DEFAULT 'unpaid',
      status TEXT DEFAULT 'issued',
      reversal_reason TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      product_id UUID REFERENCES products(id),
      product_name_snapshot TEXT NOT NULL,
      quantity NUMERIC(15,4) NOT NULL,
      unit_price NUMERIC(15,2) NOT NULL,
      unit_cost_snapshot NUMERIC(15,2) DEFAULT 0,
      discount_amount NUMERIC(15,2) DEFAULT 0,
      line_total NUMERIC(15,2) NOT NULL,
      line_cogs NUMERIC(15,2) DEFAULT 0,
      line_profit NUMERIC(15,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'cash',
      bank_name TEXT,
      account_number TEXT,
      balance NUMERIC(15,2) DEFAULT 0,
      is_default BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_number TEXT NOT NULL UNIQUE,
      customer_id UUID REFERENCES customers(id),
      invoice_id UUID REFERENCES invoices(id),
      project_id UUID REFERENCES projects(id),
      account_id UUID NOT NULL REFERENCES accounts(id),
      payment_type TEXT DEFAULT 'customer_receipt',
      amount NUMERIC(15,2) NOT NULL,
      payment_method TEXT DEFAULT 'pos',
      reference_number TEXT,
      status TEXT DEFAULT 'completed',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_allocations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
      invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      allocated_amount NUMERIC(15,2) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS commission_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      rule_type TEXT DEFAULT 'flat_percent',
      rate_percent NUMERIC(5,2) DEFAULT 5,
      project_id UUID REFERENCES projects(id),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS commission_ledger (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id UUID NOT NULL REFERENCES employees(id),
      invoice_id UUID REFERENCES invoices(id),
      project_id UUID REFERENCES projects(id),
      rule_snapshot JSONB,
      base_amount NUMERIC(15,2) NOT NULL,
      commission_amount NUMERIC(15,2) NOT NULL,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payroll_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id UUID NOT NULL REFERENCES employees(id),
      project_id UUID REFERENCES projects(id),
      period_start TIMESTAMP NOT NULL,
      period_end TIMESTAMP NOT NULL,
      base_salary NUMERIC(15,2) DEFAULT 0,
      commission_total NUMERIC(15,2) DEFAULT 0,
      deductions NUMERIC(15,2) DEFAULT 0,
      net_payable NUMERIC(15,2) DEFAULT 0,
      status TEXT DEFAULT 'draft',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      expense_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      category TEXT DEFAULT 'عمومی',
      amount NUMERIC(15,2) NOT NULL,
      project_id UUID REFERENCES projects(id),
      account_id UUID REFERENCES accounts(id),
      expense_date TIMESTAMP DEFAULT NOW() NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS consignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      consignment_number TEXT NOT NULL UNIQUE,
      customer_id UUID NOT NULL REFERENCES customers(id),
      project_id UUID REFERENCES projects(id),
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS consignment_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      consignment_id UUID NOT NULL REFERENCES consignments(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id),
      quantity_out NUMERIC(15,4) NOT NULL DEFAULT 0,
      quantity_returned NUMERIC(15,4) DEFAULT 0,
      unit_price NUMERIC(15,2) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type TEXT NOT NULL,
      severity TEXT DEFAULT 'warning',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      entity_type TEXT,
      entity_id UUID,
      project_id UUID,
      status TEXT DEFAULT 'active',
      dedup_key TEXT UNIQUE,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      assigned_employee_id UUID REFERENCES employees(id),
      project_id UUID REFERENCES projects(id),
      status TEXT DEFAULT 'open',
      priority TEXT DEFAULT 'normal',
      due_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id UUID,
      user_name TEXT DEFAULT 'کاربر سیستم',
      details JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      filename TEXT NOT NULL,
      size_bytes INTEGER DEFAULT 0,
      status TEXT DEFAULT 'completed',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );


    -- Schema reconciliation for databases created by older versions.
    -- CREATE TABLE IF NOT EXISTS never adds newly introduced columns.

    ALTER TABLE audit_logs
      ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'system_user';

    ALTER TABLE backups
      ADD COLUMN IF NOT EXISTS checksum TEXT DEFAULT 'legacy';
    ALTER TABLE backups
      ADD COLUMN IF NOT EXISTS backup_data JSONB;

    ALTER TABLE commission_ledger
      ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id);

    ALTER TABLE commission_rules
      ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);
    ALTER TABLE commission_rules
      ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id);
    ALTER TABLE commission_rules
      ADD COLUMN IF NOT EXISTS rate_value NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE commission_rules
      ADD COLUMN IF NOT EXISTS effective_start_date TIMESTAMP;
    ALTER TABLE commission_rules
      ADD COLUMN IF NOT EXISTS effective_end_date TIMESTAMP;
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'commission_rules'
          AND column_name = 'rate_percent'
      ) THEN
        EXECUTE $sql$
          UPDATE commission_rules
          SET rate_value = COALESCE(rate_value, rate_percent, 0)
          WHERE rate_value IS NULL
        $sql$;
      ELSE
        UPDATE commission_rules
        SET rate_value = COALESCE(rate_value, 0)
        WHERE rate_value IS NULL;
      END IF;
    END $$;
    ALTER TABLE commission_rules
      ALTER COLUMN rate_value SET DEFAULT 0,
      ALTER COLUMN rate_value SET NOT NULL;

    ALTER TABLE consignment_items
      ADD COLUMN IF NOT EXISTS quantity_delivered NUMERIC(15,4) DEFAULT 0;
    ALTER TABLE consignment_items
      ADD COLUMN IF NOT EXISTS quantity_sold NUMERIC(15,4) DEFAULT 0;
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'consignment_items'
          AND column_name = 'quantity_out'
      ) THEN
        ALTER TABLE consignment_items ALTER COLUMN quantity_out SET DEFAULT 0;
        EXECUTE $sql$
          UPDATE consignment_items
          SET quantity_delivered = COALESCE(quantity_delivered, quantity_out, 0),
              quantity_sold = COALESCE(quantity_sold, 0)
          WHERE quantity_delivered IS NULL OR quantity_sold IS NULL
        $sql$;
      ELSE
        UPDATE consignment_items
        SET quantity_delivered = COALESCE(quantity_delivered, 0),
            quantity_sold = COALESCE(quantity_sold, 0)
        WHERE quantity_delivered IS NULL OR quantity_sold IS NULL;
      END IF;
    END $$;
    ALTER TABLE consignment_items
      ALTER COLUMN quantity_delivered SET DEFAULT 0,
      ALTER COLUMN quantity_delivered SET NOT NULL,
      ALTER COLUMN quantity_sold SET DEFAULT 0,
      ALTER COLUMN quantity_sold SET NOT NULL;

    ALTER TABLE consignments
      ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id);
    ALTER TABLE consignments
      ADD COLUMN IF NOT EXISTS issue_date TIMESTAMP DEFAULT NOW();
    ALTER TABLE consignments
      ADD COLUMN IF NOT EXISTS total_consigned_value NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE consignments
      ADD COLUMN IF NOT EXISTS total_sold_value NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE consignments
      ADD COLUMN IF NOT EXISTS total_collected NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE consignments
      ALTER COLUMN issue_date SET DEFAULT NOW(),
      ALTER COLUMN issue_date SET NOT NULL,
      ALTER COLUMN total_consigned_value SET DEFAULT 0,
      ALTER COLUMN total_consigned_value SET NOT NULL;

    ALTER TABLE expenses
      ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id);
    ALTER TABLE expenses
      ADD COLUMN IF NOT EXISTS receipt_image_url TEXT;

    ALTER TABLE inventory_ledger
      ADD COLUMN IF NOT EXISTS created_by_id UUID;

    ALTER TABLE payments
      ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);
    ALTER TABLE payments
      ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP DEFAULT NOW();
    ALTER TABLE payments
      ALTER COLUMN payment_date SET DEFAULT NOW(),
      ALTER COLUMN payment_date SET NOT NULL;

    ALTER TABLE payroll_records
      ADD COLUMN IF NOT EXISTS period_name TEXT DEFAULT 'نامشخص';
    ALTER TABLE payroll_records
      ADD COLUMN IF NOT EXISTS commission_earned NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE payroll_records
      ADD COLUMN IF NOT EXISTS bonus NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE payroll_records
      ADD COLUMN IF NOT EXISTS advances NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE payroll_records
      ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id);
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'payroll_records'
          AND column_name = 'commission_total'
      ) THEN
        EXECUTE $sql$
          UPDATE payroll_records
          SET period_name = COALESCE(period_name, 'نامشخص'),
              commission_earned = COALESCE(commission_earned, commission_total, 0),
              bonus = COALESCE(bonus, 0),
              advances = COALESCE(advances, 0)
          WHERE period_name IS NULL OR commission_earned IS NULL OR bonus IS NULL OR advances IS NULL
        $sql$;
      ELSE
        UPDATE payroll_records
        SET period_name = COALESCE(period_name, 'نامشخص'),
            commission_earned = COALESCE(commission_earned, 0),
            bonus = COALESCE(bonus, 0),
            advances = COALESCE(advances, 0)
        WHERE period_name IS NULL OR commission_earned IS NULL OR bonus IS NULL OR advances IS NULL;
      END IF;
    END $$;
    ALTER TABLE payroll_records
      ALTER COLUMN period_name SET DEFAULT 'نامشخص',
      ALTER COLUMN period_name SET NOT NULL,
      ALTER COLUMN commission_earned SET DEFAULT 0,
      ALTER COLUMN commission_earned SET NOT NULL;

    ALTER TABLE product_recipes
      ADD COLUMN IF NOT EXISTS notes TEXT;

    ALTER TABLE production_batch_items
      ADD COLUMN IF NOT EXISTS quantity_consumed NUMERIC(15,4) DEFAULT 0;
    ALTER TABLE production_batch_items
      ADD COLUMN IF NOT EXISTS total_cost_snapshot NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE production_batch_items
      ADD COLUMN IF NOT EXISTS waste_quantity NUMERIC(15,4) DEFAULT 0;
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'production_batch_items'
          AND column_name = 'quantity_used'
        )
        AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'production_batch_items'
          AND column_name = 'total_cost'
      ) THEN
        EXECUTE $sql$
          UPDATE production_batch_items
          SET quantity_consumed = COALESCE(quantity_consumed, quantity_used, 0),
              total_cost_snapshot = COALESCE(total_cost_snapshot, total_cost, 0),
              waste_quantity = COALESCE(waste_quantity, 0)
          WHERE quantity_consumed IS NULL OR total_cost_snapshot IS NULL OR waste_quantity IS NULL
        $sql$;
      ELSE
        UPDATE production_batch_items
        SET quantity_consumed = COALESCE(quantity_consumed, 0),
            total_cost_snapshot = COALESCE(total_cost_snapshot, 0),
            waste_quantity = COALESCE(waste_quantity, 0)
        WHERE quantity_consumed IS NULL OR total_cost_snapshot IS NULL OR waste_quantity IS NULL;
      END IF;
    END $$;
    ALTER TABLE production_batch_items
      ALTER COLUMN quantity_consumed SET DEFAULT 0,
      ALTER COLUMN quantity_consumed SET NOT NULL,
      ALTER COLUMN total_cost_snapshot SET DEFAULT 0,
      ALTER COLUMN total_cost_snapshot SET NOT NULL,
      ALTER COLUMN waste_quantity SET DEFAULT 0;

    -- Retain legacy values for rollback; new inserts must not require legacy fields.
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'production_batch_items' AND column_name = 'quantity_used') THEN
        ALTER TABLE production_batch_items ALTER COLUMN quantity_used SET DEFAULT 0;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'production_batch_items' AND column_name = 'total_cost') THEN
        ALTER TABLE production_batch_items ALTER COLUMN total_cost SET DEFAULT 0;
      END IF;
    END $$;

    ALTER TABLE production_batches
      ADD COLUMN IF NOT EXISTS total_material_cost NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE production_batches
      ADD COLUMN IF NOT EXISTS production_date TIMESTAMP DEFAULT NOW();
    UPDATE production_batches
      SET total_material_cost = COALESCE(total_material_cost, 0),
          production_date = COALESCE(production_date, created_at, NOW())
      WHERE total_material_cost IS NULL OR production_date IS NULL;
    ALTER TABLE production_batches
      ALTER COLUMN total_material_cost SET DEFAULT 0,
      ALTER COLUMN total_material_cost SET NOT NULL,
      ALTER COLUMN production_date SET DEFAULT NOW(),
      ALTER COLUMN production_date SET NOT NULL;

    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS pack_quantity INTEGER DEFAULT 1;
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS image_url TEXT;
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS target_stock_quantity NUMERIC(15,4) DEFAULT 50;
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS commission_rate_percent NUMERIC(5,2) DEFAULT 5;
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS is_special BOOLEAN DEFAULT false NOT NULL;
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS notes TEXT;

    ALTER TABLE project_product_prices
      ADD COLUMN IF NOT EXISTS override_commission_rate NUMERIC(5,2);

    ALTER TABLE purchases
      ADD COLUMN IF NOT EXISTS purchase_date TIMESTAMP DEFAULT NOW();
    ALTER TABLE purchases
      ADD COLUMN IF NOT EXISTS discount NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE purchases
      ADD COLUMN IF NOT EXISTS tax NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE purchases
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
    ALTER TABLE purchases
      ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
    UPDATE purchases
      SET purchase_date = COALESCE(purchase_date, created_at, NOW()),
          discount = COALESCE(discount, 0),
          tax = COALESCE(tax, 0),
          status = COALESCE(status, 'completed'),
          payment_status = COALESCE(payment_status, 'unpaid')
      WHERE purchase_date IS NULL OR discount IS NULL OR tax IS NULL OR status IS NULL OR payment_status IS NULL;
    ALTER TABLE purchases
      ALTER COLUMN purchase_date SET DEFAULT NOW(),
      ALTER COLUMN purchase_date SET NOT NULL,
      ALTER COLUMN status SET DEFAULT 'completed',
      ALTER COLUMN status SET NOT NULL,
      ALTER COLUMN payment_status SET DEFAULT 'unpaid',
      ALTER COLUMN payment_status SET NOT NULL;

    ALTER TABLE raw_material_price_history
      ADD COLUMN IF NOT EXISTS old_cost NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE raw_material_price_history
      ADD COLUMN IF NOT EXISTS change_percent NUMERIC(7,2) DEFAULT 0;
    ALTER TABLE raw_material_price_history
      ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT 'manual_edit';
    ALTER TABLE raw_material_price_history
      ADD COLUMN IF NOT EXISTS source_reference TEXT;
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'raw_material_price_history'
          AND column_name = 'previous_cost'
      ) THEN
        EXECUTE $sql$
          UPDATE raw_material_price_history
          SET old_cost = COALESCE(old_cost, previous_cost, 0),
              change_percent = COALESCE(change_percent,
                CASE
                  WHEN COALESCE(previous_cost, 0) = 0 THEN 100
                  ELSE ROUND(((new_cost - previous_cost) / previous_cost) * 100, 2)
                END,
                0),
              reason = COALESCE(reason, 'legacy')
          WHERE old_cost IS NULL OR change_percent IS NULL OR reason IS NULL
        $sql$;
      ELSE
        UPDATE raw_material_price_history
        SET old_cost = COALESCE(old_cost, 0),
            change_percent = COALESCE(change_percent,
              CASE
                WHEN COALESCE(old_cost, 0) = 0 THEN 100
                ELSE ROUND(((new_cost - old_cost) / old_cost) * 100, 2)
              END,
              0),
            reason = COALESCE(reason, 'legacy')
        WHERE old_cost IS NULL OR change_percent IS NULL OR reason IS NULL;
      END IF;
    END $$;
    ALTER TABLE raw_material_price_history
      ALTER COLUMN old_cost SET DEFAULT 0,
      ALTER COLUMN old_cost SET NOT NULL,
      ALTER COLUMN change_percent SET DEFAULT 0,
      ALTER COLUMN change_percent SET NOT NULL,
      ALTER COLUMN reason SET DEFAULT 'manual_edit';

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS entity_type TEXT;
    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS entity_id UUID;

    ALTER TABLE warehouses
      ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
    ALTER TABLE warehouses
      ADD COLUMN IF NOT EXISTS address TEXT;

    -- Employees / partner domain expansion
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS first_name TEXT;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_name TEXT;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS national_id TEXT;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS birth_date TIMESTAMP;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS cooperation_type TEXT DEFAULT 'visitor';
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS offboarding_stage TEXT DEFAULT 'active';
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS started_at TIMESTAMP DEFAULT NOW();
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS activity_scope TEXT;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES employees(id);

    UPDATE employees
      SET first_name = COALESCE(first_name, NULLIF(split_part(name, ' ', 1), '')),
          last_name = COALESCE(last_name, NULLIF(substr(name, length(split_part(name, ' ', 1)) + 2), '')),
          started_at = COALESCE(started_at, created_at, NOW()),
          cooperation_type = COALESCE(cooperation_type, CASE WHEN role = 'visitor' THEN 'visitor' ELSE 'employee' END),
          offboarding_stage = COALESCE(offboarding_stage, CASE WHEN status = 'active' THEN 'active' ELSE 'archived' END)
      WHERE first_name IS NULL OR last_name IS NULL OR started_at IS NULL OR cooperation_type IS NULL OR offboarding_stage IS NULL;

    CREATE TABLE IF NOT EXISTS roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      project_scoped BOOLEAN DEFAULT true NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );
    CREATE TABLE IF NOT EXISTS employee_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id UUID NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role_id UUID REFERENCES roles(id),
      status TEXT DEFAULT 'active' NOT NULL,
      last_login_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS employee_project_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'member' NOT NULL,
      started_at TIMESTAMP DEFAULT NOW() NOT NULL,
      ended_at TIMESTAMP,
      status TEXT DEFAULT 'active' NOT NULL,
      commission_rate NUMERIC(5,2),
      project_salary NUMERIC(15,2) DEFAULT 0,
      permission_set JSONB DEFAULT '{}',
      UNIQUE(employee_id, project_id)
    );
    CREATE TABLE IF NOT EXISTS project_compensations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      employee_id UUID NOT NULL REFERENCES employees(id),
      amount NUMERIC(15,2) NOT NULL,
      effective_start_date TIMESTAMP DEFAULT NOW() NOT NULL,
      effective_end_date TIMESTAMP,
      status TEXT DEFAULT 'active' NOT NULL,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS project_targets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      period_start TIMESTAMP NOT NULL,
      period_end TIMESTAMP NOT NULL,
      sales_target NUMERIC(15,2) DEFAULT 0,
      customer_target INTEGER DEFAULT 0,
      profit_target NUMERIC(15,2) DEFAULT 0,
      collection_target NUMERIC(15,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customer_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      employee_id UUID REFERENCES employees(id),
      project_id UUID REFERENCES projects(id),
      assigned_at TIMESTAMP DEFAULT NOW() NOT NULL,
      assigned_by TEXT DEFAULT 'system',
      assignment_reason TEXT,
      status TEXT DEFAULT 'active' NOT NULL,
      ended_at TIMESTAMP
    );

    ALTER TABLE projects ADD COLUMN IF NOT EXISTS manager_employee_id UUID REFERENCES employees(id);
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS logo_url TEXT;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_monthly_sales NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_yearly_sales NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_customer_count INTEGER DEFAULT 0;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_profit NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_collection NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS independent_sales_allowed BOOLEAN DEFAULT false;

    ALTER TABLE project_product_prices ADD COLUMN IF NOT EXISTS effective_start_date TIMESTAMP DEFAULT NOW();
    ALTER TABLE project_product_prices ADD COLUMN IF NOT EXISTS effective_end_date TIMESTAMP;

    ALTER TABLE commission_ledger ADD COLUMN IF NOT EXISTS recipient_employee_id UUID REFERENCES employees(id);
    ALTER TABLE commission_ledger ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'employee';
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS commission_base TEXT DEFAULT 'sales_total';
    ALTER TABLE commission_rules ADD COLUMN IF NOT EXISTS commission_base TEXT DEFAULT 'sales_total';
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'تهران';
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS payable_balance NUMERIC(15,2) DEFAULT 0;

    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS commission_snapshot JSONB;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS price_snapshot JSONB;

    ALTER TABLE invoice_items ALTER COLUMN product_id DROP NOT NULL;
    ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false;
    ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS custom_unit TEXT DEFAULT 'عدد';
    ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS custom_notes TEXT;

    INSERT INTO employee_project_assignments(employee_id, project_id, role, started_at, status)
      SELECT epm.employee_id, epm.project_id, 'member', epm.assigned_at, 'active'
      FROM employee_project_memberships epm
      ON CONFLICT (employee_id, project_id) DO NOTHING;

    INSERT INTO customer_assignments(customer_id, employee_id, assigned_at, assignment_reason, status)
      SELECT c.id, c.assigned_employee_id, COALESCE(c.updated_at, NOW()), 'legacy_assignment', 'active'
      FROM customers c
      WHERE c.assigned_employee_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM customer_assignments ca WHERE ca.customer_id = c.id AND ca.status = 'active');

    INSERT INTO roles(code, name, project_scoped) VALUES
      ('admin', 'مدیر سیستم', false),
      ('manager', 'مدیر', true),
      ('sales', 'فروشنده / ویزیتور', true),
      ('visitor', 'ویزیتور', true),
      ('accountant', 'حسابدار', true),
      ('warehouse', 'انباردار', true)
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO permissions(code, name) VALUES
      ('customers.view','مشاهده مشتریان'),('customers.create','ایجاد مشتری'),('customers.update','ویرایش مشتری'),
      ('customers.archive','آرشیو مشتری'),('orders.view','مشاهده سفارش'),('orders.create','ثبت سفارش'),('invoices.create','ایجاد فاکتور'),('invoices.update','ویرایش فاکتور'),
      ('orders.update','ویرایش سفارش'),('orders.cancel','لغو سفارش'),('invoices.view','مشاهده فاکتور'),
      ('commissions.view','مشاهده پورسانت'),('commissions.manage','مدیریت پورسانت'),('reports.view','مشاهده گزارش'),('reports.export','خروجی گزارش'),('reports.simulate','شبیه‌سازی گزارش'),('cost.view','مشاهده قیمت خرید'),
      ('profit.view','مشاهده سود'),('projects.view','مشاهده پروژه'),('projects.update','تغییر پروژه'),
      ('customers.transfer','انتقال مشتری'),('employees.manage','مدیریت همکاران'),('employees.view','مشاهده همکاران'),('employees.offboard','収束 همکار'),('projects.create','ایجاد پروژه'),('projects.archive','آرشیو پروژه'),('projects.price.manage','مدیریت قیمت پروژه'),('projects.commission.manage','مدیریت پورسانت پروژه'),('projects.expense.manage','مدیریت هزینه پروژه'),('tasks.manage','مدیریت وظایف'),('payments.create','ثبت پرداخت'),('payments.view','مشاهده پرداخت'),
      ('products.view','مشاهده محصولات'),('products.create','ایجاد محصول'),('products.update','ویرایش محصول'),('products.delete','حذف یا بایگانی محصول'),
      ('raw_materials.view','مشاهده مواد اولیه'),('raw_materials.create','ایجاد ماده اولیه'),('raw_materials.update','ویرایش ماده اولیه'),
      ('suppliers.view','مشاهده تامین‌کنندگان'),('suppliers.create','ایجاد تامین‌کننده'),('suppliers.update','ویرایش تامین‌کننده'),
      ('production.view','مشاهده تولید'),('production.create','ثبت تولید'),('inventory.view','مشاهده انبار'),('purchases.view','مشاهده خرید'),('purchases.create','ایجاد خرید'),('purchases.edit','ویرایش خرید'),('purchases.delete','حذف خرید'),
      ('expenses.view','مشاهده هزینه‌ها'),('expenses.create','ایجاد هزینه'),('expenses.edit','ویرایش هزینه'),('expenses.delete','حذف هزینه'),
      ('financial.view','مشاهده مالی'),('financial.edit','ویرایش مالی'),('admin.settings','تنظیمات مدیریتی'),
      ('alerts.view','مشاهده اعلان‌ها'),('alerts.resolve','حل اعلان‌ها'),
      ('ai.view','مشاهده هوش مصنوعی'),('backup.view','مشاهده پشتیبان‌گیری'),('backup.create','ایجاد پشتیبان'),('settings.view','مشاهده تنظیمات'),
      ('global_search','جستجوی سراسری'),
      ('invoices.pay','ثبت وصول فاکتور'),('invoices.delete','حذف فاکتور'),('invoices.reverse','ابطال فاکتور')
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO role_permissions(role_id, permission_id)
      SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code='admin'
    ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions(role_id, permission_id)
      SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('customers.view','customers.create','customers.update','orders.view','orders.create','invoices.view','invoices.create','invoices.update','commissions.view','reports.view','projects.view','customers.transfer','payments.create') WHERE r.code='sales'
    ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions(role_id, permission_id)
      SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('customers.view','customers.create','customers.update','orders.view','orders.create','orders.update','orders.cancel','invoices.view','invoices.create','invoices.update','commissions.view','reports.view','cost.view','profit.view','projects.view','projects.create','projects.update','projects.price.manage','projects.commission.manage','projects.expense.manage','customers.transfer','payments.create','employees.view','employees.manage','expenses.view','expenses.create','expenses.edit','expenses.delete','purchases.view','purchases.create','purchases.edit','purchases.delete','alerts.view','alerts.resolve','production.create','financial.edit','admin.settings','backup.create','global_search','invoices.reverse','invoices.delete') WHERE r.code='manager'
    ON CONFLICT DO NOTHING;
    INSERT INTO role_permissions(role_id, permission_id)
      SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('customers.view','customers.create','customers.update','invoices.view','invoices.create','invoices.update','customers.transfer','payments.create','projects.view','reports.view','products.view','global_search') WHERE r.code='visitor'
    ON CONFLICT DO NOTHING;

    INSERT INTO role_permissions(role_id, permission_id)
      SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('customers.view','invoices.view','invoices.create','invoices.update','payments.view','payments.create','reports.view','cost.view','profit.view','projects.view','products.view','raw_materials.view','suppliers.view','financial.view','expenses.view','expenses.create','purchases.view','global_search') WHERE r.code='accountant'
    ON CONFLICT DO NOTHING;

    -- Legacy columns are retained without requiring obsolete fields on new inserts.
    ALTER TABLE raw_material_price_history ALTER COLUMN previous_cost DROP NOT NULL;
    ALTER TABLE payroll_records ALTER COLUMN period_start DROP NOT NULL;
    ALTER TABLE payroll_records ALTER COLUMN period_end DROP NOT NULL;

    -- 20260905 request idempotency: nullable additions retain all existing rows.
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS request_key TEXT;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS request_hash TEXT;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS request_key TEXT;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS request_hash TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS invoices_request_key_unique ON invoices(request_key);
    CREATE UNIQUE INDEX IF NOT EXISTS payments_request_key_unique ON payments(request_key);

    -- Phase 21: Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_employee ON invoices(employee_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);

    CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
    CREATE INDEX IF NOT EXISTS idx_payments_project ON payments(project_id);
    CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
    CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(payment_type);

    CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory_ledger(warehouse_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_item ON inventory_ledger(item_type, item_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_date ON inventory_ledger(created_at);

    CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

    CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_project ON purchases(project_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);

    CREATE INDEX IF NOT EXISTS idx_commission_employee ON commission_ledger(employee_id);
    CREATE INDEX IF NOT EXISTS idx_commission_project ON commission_ledger(project_id);

    CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
    CREATE INDEX IF NOT EXISTS idx_alerts_project ON alerts(project_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);

    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

    CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
    CREATE INDEX IF NOT EXISTS idx_customers_employee ON customers(assigned_employee_id);
    CREATE INDEX IF NOT EXISTS idx_customers_health ON customers(health_status);

    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

    CREATE INDEX IF NOT EXISTS idx_raw_materials_status ON raw_materials(status);
    CREATE INDEX IF NOT EXISTS idx_raw_materials_supplier ON raw_materials(supplier_id);

    CREATE INDEX IF NOT EXISTS idx_production_product ON production_batches(product_id);
    CREATE INDEX IF NOT EXISTS idx_production_project ON production_batches(project_id);
    CREATE INDEX IF NOT EXISTS idx_production_status ON production_batches(status);

    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_employee ON tasks(assigned_employee_id);

    CREATE INDEX IF NOT EXISTS idx_consignments_customer ON consignments(customer_id);
    CREATE INDEX IF NOT EXISTS idx_consignments_project ON consignments(project_id);
    CREATE INDEX IF NOT EXISTS idx_consignments_employee ON consignments(employee_id);

    ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS neshan_api_key TEXT;
    ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS map_provider TEXT DEFAULT 'neshan';
    ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS economic_code TEXT;
    ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS national_id TEXT;
    ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS registration_number TEXT;
    ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS postal_code TEXT;
    ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS company_address TEXT;
    ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS company_phone TEXT;
    ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS tax_office TEXT;
    ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS tax_rate_corporate INTEGER DEFAULT 25;
    ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS vat_rate INTEGER DEFAULT 10;

    -- Ensure customers lat/lng are nullable (no default Tehran)
    ALTER TABLE customers ALTER COLUMN latitude DROP DEFAULT;
    ALTER TABLE customers ALTER COLUMN longitude DROP DEFAULT;

    CREATE TABLE IF NOT EXISTS special_products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'اختصاصی' NOT NULL,
      unit TEXT DEFAULT 'عدد' NOT NULL,
      image_url TEXT,
      description TEXT,
      base_price NUMERIC(15,2) DEFAULT 0,
      stock_quantity NUMERIC(15,4) DEFAULT 0,
      min_stock_quantity NUMERIC(15,4) DEFAULT 0,
      status TEXT DEFAULT 'active' NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS code_sequences (
      id TEXT PRIMARY KEY,
      last_value INTEGER DEFAULT 0 NOT NULL,
      prefix TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    INSERT INTO code_sequences (id, last_value, prefix)
    VALUES 
      ('product', 0, 'PRD-'),
      ('special_product', 0, 'SPC-')
    ON CONFLICT (id) DO NOTHING;

    ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS pack_quantity INTEGER DEFAULT 1;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS target_stock_quantity NUMERIC(15,4) DEFAULT 50;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_rate_percent NUMERIC(5,2) DEFAULT 5;

    ALTER TABLE special_products ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE special_products ADD COLUMN IF NOT EXISTS image_url TEXT;
    ALTER TABLE special_products ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE special_products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

    CREATE INDEX IF NOT EXISTS idx_special_products_status ON special_products(status);
    CREATE INDEX IF NOT EXISTS idx_special_products_category ON special_products(category);
    CREATE INDEX IF NOT EXISTS idx_special_products_code ON special_products(code);

    CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);

    -- Default Accounts Seeding
    INSERT INTO accounts (code, name, type, bank_name, account_number, balance, is_default)
    VALUES
      ('ACC-1001', 'صندوق نقدینگی مرکزی', 'cash', NULL, NULL, 50000000, true),
      ('ACC-1002', 'حساب جاری بانک ملت', 'bank', 'بانک ملت', '6104337890123456', 150000000, false),
      ('ACC-1003', 'دستگاه کارتخوان (POS)', 'pos', 'بانک ملی', '6037991823456789', 25000000, false)
    ON CONFLICT (code) DO NOTHING;

  `);

  console.log("Migration completed successfully!");
}

