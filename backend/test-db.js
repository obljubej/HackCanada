import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://reaytiptihcaxlikrbxv.supabase.co/', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlYXl0aXB0aWhjYXhsaWtyYnh2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1ODA1MCwiZXhwIjoyMDg4NDM0MDUwfQ.hSEpDC5pIqoGMVdtZBvhfRWVF_7jdRBfJb_QUBzVo3E');

(async () => {
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
})();
