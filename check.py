import psycopg2
from psycopg2.extras import RealDictCursor
import json

CONNECTION_STRING = "postgresql://postgres.awyihjjjlnqbhccmfsoa:1uT67ZSnBPM5DFa5@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"

conn = psycopg2.connect(CONNECTION_STRING, connect_timeout=10)
cur  = conn.cursor(cursor_factory=RealDictCursor)

cur.execute("""
    SELECT company_id, away_mode_schedule, maintenance_mode, blocking_enabled
    FROM companies
    WHERE company_id = 'mediagully'
""")
row = cur.fetchone()
print("company_id:", row['company_id'])
print("maintenance_mode:", row['maintenance_mode'])
print("blocking_enabled:", row['blocking_enabled'])
print("away_mode_schedule:")
print(json.dumps(row['away_mode_schedule'], indent=2))

cur.close()
conn.close()