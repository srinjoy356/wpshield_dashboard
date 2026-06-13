import psycopg2
from psycopg2.extras import RealDictCursor

CONNECTION_STRING = "postgresql://postgres.awyihjjjlnqbhccmfsoa:1uT67ZSnBPM5DFa5@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"

conn = psycopg2.connect(CONNECTION_STRING, connect_timeout=10)
cur  = conn.cursor(cursor_factory=RealDictCursor)

cur.execute("SELECT id, version, zip_url, zip_path, is_latest, released_at FROM plugin_releases ORDER BY released_at DESC")
releases = cur.fetchall()
for r in releases:
    print(dict(r))

cur.close()
conn.close()