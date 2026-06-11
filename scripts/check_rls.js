const { Client } = require('pg');

async function checkRLS() {
  const client = new Client({
    connectionString: process.env.CONNECTION_STRING
  });

  try {
    await client.connect();
    const res = await client.query(`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relnamespace = 'public'::regnamespace 
      AND relkind = 'r'
      ORDER BY relname;
    `);

    console.log('--- RLS Status for Public Tables ---');
    res.rows.forEach(row => {
      console.log(`${row.relname.padEnd(30, ' ')} | RLS Enabled: ${row.relrowsecurity}`);
    });
  } catch (err) {
    console.error('Error executing query', err.stack);
  } finally {
    await client.end();
  }
}

checkRLS();
