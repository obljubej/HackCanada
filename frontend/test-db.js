const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabase = createClient(
  'https://reaytiptihcaxlikrbxv.supabase.co/',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlYXl0aXB0aWhjYXhsaWtyYnh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NTgwNTAsImV4cCI6MjA4ODQzNDA1MH0.op5GWDKdHe1uT3HcdPvPQeCauf1L2Fr1HysAuo76JIc'
);

async function run() {
  const { data, error } = await supabase.from('profiles').select('*').limit(2);
  fs.writeFileSync('db-output.json', JSON.stringify({ data, error }, null, 2));
}
run();
