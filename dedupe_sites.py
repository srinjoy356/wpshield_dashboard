import psycopg2
import psycopg2.extras

CONNECTION_STRING = "postgresql://postgres.awyihjjjlnqbhccmfsoa:1uT67ZSnBPM5DFa5@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"

def run():
    conn = None
    try:
        print("Connecting to Supabase PostgreSQL...")
        conn = psycopg2.connect(CONNECTION_STRING)
        conn.autocommit = False
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        print("\nFetching all sites to identify duplicates...")
        cur.execute("SELECT id, url, company_id, last_seen_at, created_at FROM public.sites;")
        sites = cur.fetchall()

        # Group sites by (company_id, url)
        grouped_sites = {}
        for site in sites:
            key = (site['company_id'], site['url'])
            if key not in grouped_sites:
                grouped_sites[key] = []
            grouped_sites[key].append(site)

        duplicates_found = False
        ids_to_delete = []

        for key, site_list in grouped_sites.items():
            if len(site_list) > 1:
                duplicates_found = True
                print(f"Found {len(site_list)} duplicates for URL: {key[1]} (Company: {key[0]})")
                
                # Sort by last_seen_at descending, then created_at descending
                site_list.sort(key=lambda x: (x['last_seen_at'] or x['created_at'], x['created_at']), reverse=True)
                
                # Keep the first one (most recently seen/created)
                kept_site = site_list[0]
                print(f"  Keeping Site ID: {kept_site['id']}")
                
                # Mark the rest for deletion
                for dup in site_list[1:]:
                    ids_to_delete.append(dup['id'])
                    print(f"  Removing Site ID: {dup['id']}")

        if duplicates_found and ids_to_delete:
            print(f"\nDeleting {len(ids_to_delete)} duplicate site entries...")
            
            # Find all foreign keys referencing public.sites
            cur.execute("""
                SELECT tc.table_name, kcu.column_name
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND ccu.table_name = 'sites'
                  AND ccu.column_name = 'id';
            """)
            fks = cur.fetchall()
            
            for key, site_list in grouped_sites.items():
                if len(site_list) > 1:
                    dup_ids = [dup['id'] for dup in site_list[1:]]
                    
                    for fk in fks:
                        table_name = fk['table_name']
                        col_name = fk['column_name']
                        
                        # Delete child records belonging to the duplicates to avoid unique constraint collisions
                        delete_query = f"DELETE FROM public.{table_name} WHERE {col_name} = ANY(%s::uuid[]);"
                        cur.execute(delete_query, (dup_ids,))

            # Finally, delete the duplicate sites
            delete_sites_query = "DELETE FROM public.sites WHERE id = ANY(%s::uuid[]);"
            cur.execute(delete_sites_query, (ids_to_delete,))
            
            print(f"Deleted successfully.")
            
            print("\nApplying UNIQUE constraint to prevent future duplicates...")
            # Apply unique constraint on company_id and url
            constraint_sql = """
            ALTER TABLE public.sites 
            DROP CONSTRAINT IF EXISTS unique_company_url;

            ALTER TABLE public.sites 
            ADD CONSTRAINT unique_company_url UNIQUE (company_id, url);
            """
            cur.execute(constraint_sql)
            print("UNIQUE constraint applied successfully on (company_id, url)!")

            conn.commit()
        else:
            print("No duplicates found!")

            print("\nApplying UNIQUE constraint to prevent future duplicates...")
            # Apply unique constraint on company_id and url
            constraint_sql = """
            ALTER TABLE public.sites 
            DROP CONSTRAINT IF EXISTS unique_company_url;

            ALTER TABLE public.sites 
            ADD CONSTRAINT unique_company_url UNIQUE (company_id, url);
            """
            cur.execute(constraint_sql)
            print("UNIQUE constraint applied successfully on (company_id, url)!")

            conn.commit()

        cur.close()
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"\n❌ Failed: {e}")
    finally:
        if conn:
            conn.close()
            print("\nConnection closed.")

if __name__ == "__main__":
    run()
