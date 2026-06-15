"""
Fetches complete live schema and outputs it.
Run: python fetch_schema_dump.py > schema_dump.txt
"""
import psycopg2, json
from psycopg2.extras import RealDictCursor
import datetime

CONNECTION_STRING = "postgresql://postgres.awyihjjjlnqbhccmfsoa:1uT67ZSnBPM5DFa5@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
conn = psycopg2.connect(CONNECTION_STRING, connect_timeout=10)
cur  = conn.cursor(cursor_factory=RealDictCursor)

def default(o):
    if isinstance(o, (datetime.datetime, datetime.date)): return str(o)
    if isinstance(o, list): return list(o)
    return str(o)

data = {}

# Tables + columns
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")
tables = [r['table_name'] for r in cur.fetchall()]
data['tables'] = {}
for t in tables:
    cur.execute("SELECT column_name, data_type, is_nullable, column_default, udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position", (t,))
    data['tables'][t] = [dict(r) for r in cur.fetchall()]

# Sequences
cur.execute("SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public' ORDER BY sequence_name")
data['sequences'] = [r['sequence_name'] for r in cur.fetchall()]

# Foreign keys
cur.execute("""
    SELECT tc.table_name, kcu.column_name, ccu.table_name AS ref_table,
           ccu.column_name AS ref_column, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema
    WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public' ORDER BY tc.table_name
""")
data['foreign_keys'] = [dict(r) for r in cur.fetchall()]

# Indexes
cur.execute("SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND indexname NOT LIKE '%_pkey' ORDER BY tablename, indexname")
data['indexes'] = [dict(r) for r in cur.fetchall()]

# RLS Policies
cur.execute("SELECT tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname")
data['policies'] = [dict(r) for r in cur.fetchall()]

# Plans seed
cur.execute("SELECT * FROM plans ORDER BY price_usd")
data['plans'] = [dict(r) for r in cur.fetchall()]

cur.close()
conn.close()

print(json.dumps(data, indent=2, default=default))