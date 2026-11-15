require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

let client = null;

// Lazily create a single shared Supabase client. Creating it at import time
// made the whole serverless function crash when env vars were missing,
// which hid the real problem behind a generic 500.
const getSupabase = () => {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_KEY environment variable. ' +
        'Set them in your Vercel project settings (Settings > Environment Variables).'
    );
  }

  client = createClient(url, key);
  return client;
};

module.exports = { getSupabase };
