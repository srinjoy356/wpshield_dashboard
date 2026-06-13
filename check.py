"""
Fetch complete Supabase schema and generate a full creation script.
Run: python fetch_full_schema.py
"""
import psycopg2
from psycopg2.extras import RealDictCursor

CONNECTION_STRING = "postgresql://postgres.awyihjjjlnqbhccmfsoa:1uT67ZSnBPM5DFa5@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"

conn = psycopg2.connect(CONNECTION_STRING, connect_timeout=10)
cur  = conn.cursor(cursor_factory=RealDictCursor)

lines = []
lines.append("-- ============================================================")
lines.append("-- WPShield Complete Schema Creation Script")
lines.append("-- Run on a fresh Supabase project to recreate everything")
lines.append("-- ============================================================\n")

# 0. Helper functions first (required by RLS policies)
lines.append("-- Helper functions (required by RLS policies)")
cur.execute("""
    SELECT routine_name, routine_definition
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
    ORDER BY routine_name
""")
funcs = cur.fetchall()
for f in funcs:
    lines.append(f"-- Function: {f['routine_name']}")

# Hardcode since pg doesn't expose full function def easily via info_schema
lines.append("""
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT company_id FROM user_profiles WHERE id = auth.uid();
$$;
""")

# 1. Sequences for bigint tables
lines.append("-- Sequences (for bigint auto-increment columns)")
cur.execute("""
    SELECT sequence_name FROM information_schema.sequences
    WHERE sequence_schema = 'public'
    ORDER BY sequence_name
""")
seqs = cur.fetchall()
for s in seqs:
    lines.append(f"CREATE SEQUENCE IF NOT EXISTS {s['sequence_name']};")
lines.append("")

# 2. Tables
cur.execute("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
""")
tables = [r['table_name'] for r in cur.fetchall()]
print(f"Found {len(tables)} tables")

for table in tables:
    cur.execute("""
        SELECT column_name, data_type, character_maximum_length,
               is_nullable, column_default, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position
    """, (table,))
    cols = cur.fetchall()

    lines.append(f"CREATE TABLE IF NOT EXISTS {table} (")
    col_defs = []
    for c in cols:
        dtype = c['data_type']
        if dtype == 'USER-DEFINED':
            dtype = c['udt_name']
        elif dtype == 'character varying':
            dtype = f"varchar({c['character_maximum_length']})" if c['character_maximum_length'] else 'text'
        elif dtype == 'timestamp with time zone':
            dtype = 'timestamptz'
        elif dtype == 'ARRAY':
            dtype = f"{c['udt_name'].lstrip('_')}[]"

        nullable = '' if c['is_nullable'] == 'YES' else ' NOT NULL'
        default  = f" DEFAULT {c['column_default']}" if c['column_default'] else ''
        col_defs.append(f"  {c['column_name']} {dtype}{nullable}{default}")
    lines.append(',\n'.join(col_defs))
    lines.append(');\n')

# 3. Primary keys
cur.execute("""
    SELECT tc.table_name, string_agg(kcu.column_name, ', ') as cols
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
    GROUP BY tc.table_name ORDER BY tc.table_name
""")
lines.append("-- PRIMARY KEYS")
for r in cur.fetchall():
    lines.append(f"ALTER TABLE {r['table_name']} ADD PRIMARY KEY ({r['cols']});")
lines.append("")

# 4. Foreign keys
cur.execute("""
    SELECT tc.table_name, kcu.column_name,
           ccu.table_name AS ref_table, ccu.column_name AS ref_column,
           tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name
""")
lines.append("-- FOREIGN KEYS")
for r in cur.fetchall():
    lines.append(f"ALTER TABLE {r['table_name']} ADD CONSTRAINT {r['constraint_name']} FOREIGN KEY ({r['column_name']}) REFERENCES {r['ref_table']}({r['ref_column']});")
lines.append("")

# 5. Indexes
cur.execute("""
    SELECT tablename, indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND indexname NOT LIKE '%_pkey'
    ORDER BY tablename, indexname
""")
lines.append("-- INDEXES")
for r in cur.fetchall():
    lines.append(f"{r['indexdef']};")
lines.append("")

# 6. RLS
cur.execute("""
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies WHERE schemaname = 'public'
    ORDER BY tablename, policyname
""")
policies = cur.fetchall()
tables_with_rls = sorted(set(r['tablename'] for r in policies))
lines.append("-- ENABLE RLS")
for t in tables_with_rls:
    lines.append(f"ALTER TABLE {t} ENABLE ROW LEVEL SECURITY;")
lines.append("")
lines.append("-- RLS POLICIES")
for r in policies:
    roles = ', '.join(r['roles']) if r['roles'] else 'public'
    perm  = 'PERMISSIVE' if r['permissive'] == 'PERMISSIVE' else 'RESTRICTIVE'
    qual  = f" USING ({r['qual']})" if r['qual'] else ''
    check = f" WITH CHECK ({r['with_check']})" if r['with_check'] else ''
    lines.append(f'CREATE POLICY "{r["policyname"]}" ON {r["tablename"]}')
    lines.append(f'  AS {perm} FOR {r["cmd"]} TO {roles}{qual}{check};')
lines.append("")

# 7. Grants
lines.append("-- GRANTS")
for table in tables:
    lines.append(f"GRANT ALL ON {table} TO service_role;")
lines.append("")
lines.append("-- Revoke broad anon access from sensitive tables")
lines.append("REVOKE ALL ON report_history FROM anon;")
lines.append("REVOKE ALL ON scheduled_reports FROM anon;")
lines.append("REVOKE ALL ON managed_reviews FROM anon;")
lines.append("REVOKE ALL ON customers FROM anon;")
lines.append("REVOKE ALL ON subscriptions FROM anon;")
lines.append("REVOKE ALL ON licenses FROM anon;")
lines.append("REVOKE ALL ON invoices FROM anon;")
lines.append("REVOKE ALL ON site_tokens FROM anon;")
lines.append("REVOKE ALL ON mfa_codes FROM anon;")
lines.append("REVOKE ALL ON pending_checkouts FROM anon;")
lines.append("")

# 8. Seed plans with proper quoting
cur.execute("SELECT * FROM plans ORDER BY price_usd")
plans = cur.fetchall()
if plans:
    lines.append("-- SEED: plans")
    for p in plans:
        def quote(v):
            if v is None:
                return 'NULL'
            if isinstance(v, bool):
                return str(v).upper()
            if isinstance(v, (int, float)):
                return str(v)
            return f"'{str(v)}'"
        cols = ', '.join(p.keys())
        vals = ', '.join(quote(v) for v in p.values())
        lines.append(f"INSERT INTO plans ({cols}) VALUES ({vals}) ON CONFLICT (id) DO NOTHING;")

cur.close()
conn.close()

output = '\n'.join(lines)
with open('wpshield_full_schema.sql', 'w', encoding='utf-8') as f:
    f.write(output)
print(f"Done — wpshield_full_schema.sql ({len(lines)} lines)")