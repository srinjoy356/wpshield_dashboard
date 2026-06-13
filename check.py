"""
Fix RLS and grants for plugin_releases and pending_checkouts tables.
Run: python fix_rls.py
"""
import psycopg2

CONNECTION_STRING = "postgresql://postgres.awyihjjjlnqbhccmfsoa:1uT67ZSnBPM5DFa5@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"

statements = [
    # plugin_releases
    "GRANT ALL ON TABLE plugin_releases TO service_role",
    "GRANT ALL ON TABLE plugin_releases TO authenticated",
    "ALTER TABLE plugin_releases ENABLE ROW LEVEL SECURITY",
    "DROP POLICY IF EXISTS service_role_all ON plugin_releases",
    "CREATE POLICY service_role_all ON plugin_releases FOR ALL TO service_role USING (true) WITH CHECK (true)",
    "DROP POLICY IF EXISTS admin_read ON plugin_releases",
    "CREATE POLICY admin_read ON plugin_releases FOR SELECT TO authenticated USING (true)",

    # pending_checkouts
    "GRANT ALL ON TABLE pending_checkouts TO service_role",
    "GRANT ALL ON TABLE pending_checkouts TO authenticated",
    "ALTER TABLE pending_checkouts ENABLE ROW LEVEL SECURITY",
    "DROP POLICY IF EXISTS service_role_all ON pending_checkouts",
    "CREATE POLICY service_role_all ON pending_checkouts FOR ALL TO service_role USING (true) WITH CHECK (true)",
    "DROP POLICY IF EXISTS owner_read ON pending_checkouts",
    "CREATE POLICY owner_read ON pending_checkouts FOR SELECT TO authenticated USING (auth.uid() = user_id)",
]

conn = psycopg2.connect(CONNECTION_STRING, connect_timeout=10)
conn.autocommit = True
cur = conn.cursor()

for sql in statements:
    try:
        cur.execute(sql)
        print(f"OK: {sql[:60]}")
    except Exception as e:
        print(f"ERR: {sql[:60]} — {e}")

cur.close()
conn.close()
print("\nDone.")