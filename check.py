"""
Fix RLS Public Bypass Policies (SEC-P0-01)
Run: python fix_rls.py
"""
import psycopg2

CONNECTION_STRING = "postgresql://postgres.awyihjjjlnqbhccmfsoa:1uT67ZSnBPM5DFa5@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"

SQL_STATEMENTS = [
    # customers
    'DROP POLICY IF EXISTS "Admin access bypass" ON customers',
    'CREATE POLICY "customers_service_role" ON customers FOR ALL TO service_role USING (true) WITH CHECK (true)',
    'CREATE POLICY "customers_owner_read" ON customers FOR SELECT TO authenticated USING (owner_user_id = auth.uid())',
    'CREATE POLICY "customers_owner_write" ON customers FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid())',

    # subscriptions
    'DROP POLICY IF EXISTS "Admin access bypass" ON subscriptions',
    'CREATE POLICY "subscriptions_service_role" ON subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true)',
    'CREATE POLICY "subscriptions_owner_read" ON subscriptions FOR SELECT TO authenticated USING (customer_id IN (SELECT id FROM customers WHERE owner_user_id = auth.uid()))',

    # licenses
    'DROP POLICY IF EXISTS "Admin access bypass" ON licenses',
    'CREATE POLICY "licenses_service_role" ON licenses FOR ALL TO service_role USING (true) WITH CHECK (true)',
    'CREATE POLICY "licenses_owner_read" ON licenses FOR SELECT TO authenticated USING (subscription_id IN (SELECT s.id FROM subscriptions s JOIN customers c ON c.id = s.customer_id WHERE c.owner_user_id = auth.uid()))',

    # invoices
    'DROP POLICY IF EXISTS "Admin access bypass" ON invoices',
    'CREATE POLICY "invoices_service_role" ON invoices FOR ALL TO service_role USING (true) WITH CHECK (true)',
    'CREATE POLICY "invoices_owner_read" ON invoices FOR SELECT TO authenticated USING (customer_id IN (SELECT id FROM customers WHERE owner_user_id = auth.uid()))',

    # site_tokens
    'DROP POLICY IF EXISTS "Admin access bypass" ON site_tokens',
    'CREATE POLICY "site_tokens_service_role" ON site_tokens FOR ALL TO service_role USING (true) WITH CHECK (true)',

    # sites
    'DROP POLICY IF EXISTS "Admin access bypass" ON sites',
    'CREATE POLICY "sites_service_role" ON sites FOR ALL TO service_role USING (true) WITH CHECK (true)',
    'CREATE POLICY "sites_owner_read" ON sites FOR SELECT TO authenticated USING (company_id = get_user_company_id())',

    # webhook_events
    'DROP POLICY IF EXISTS "Admin access bypass" ON webhook_events',
    'CREATE POLICY "webhook_events_service_role" ON webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true)',

    # entitlements
    'DROP POLICY IF EXISTS "Admin access bypass" ON entitlements',
    'CREATE POLICY "entitlements_service_role" ON entitlements FOR ALL TO service_role USING (true) WITH CHECK (true)',
    'CREATE POLICY "entitlements_read" ON entitlements FOR SELECT TO authenticated USING (true)',

    # api_audit_logs
    'DROP POLICY IF EXISTS "Admin access bypass" ON api_audit_logs',
    'CREATE POLICY "api_audit_logs_service_role" ON api_audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true)',
    'CREATE POLICY "api_audit_logs_admin_read" ON api_audit_logs FOR SELECT TO authenticated USING (is_admin())',

    # Admin read-all policies
    'DROP POLICY IF EXISTS "customers_admin_all" ON customers',
    'CREATE POLICY "customers_admin_all" ON customers FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())',
    'DROP POLICY IF EXISTS "subscriptions_admin_all" ON subscriptions',
    'CREATE POLICY "subscriptions_admin_all" ON subscriptions FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())',
    'DROP POLICY IF EXISTS "licenses_admin_all" ON licenses',
    'CREATE POLICY "licenses_admin_all" ON licenses FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())',
    'DROP POLICY IF EXISTS "invoices_admin_all" ON invoices',
    'CREATE POLICY "invoices_admin_all" ON invoices FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())',
    'DROP POLICY IF EXISTS "sites_admin_all" ON sites',
    'CREATE POLICY "sites_admin_all" ON sites FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())',
]

conn = psycopg2.connect(CONNECTION_STRING, connect_timeout=10)
conn.autocommit = True
cur  = conn.cursor()

print("Applying RLS policy fixes...\n")
passed = 0
failed = 0
for sql in SQL_STATEMENTS:
    try:
        cur.execute(sql)
        label = sql[:70].replace('\n', ' ')
        print(f"  OK: {label}")
        passed += 1
    except Exception as e:
        label = sql[:70].replace('\n', ' ')
        print(f"  ERR: {label}")
        print(f"       {e}")
        failed += 1

cur.close()
conn.close()

print(f"\nDone — {passed} passed, {failed} failed")