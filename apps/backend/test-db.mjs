import 'dotenv/config';
import dns from 'node:dns';
import pg from 'pg';

// Prefer IPv4 when resolving database hostnames.
dns.setDefaultResultOrder('ipv4first');

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL,
  connectionTimeoutMillis: 15000,
});

try {
  const result = await pool.query('SELECT NOW()');

  console.log('DIRECT_URL connection successful:');
  console.log(result.rows[0]);
} catch (error) {
  console.error('DIRECT_URL connection failed:');
  console.error(error);
} finally {
  await pool.end();
}