import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://reaytiptihcaxlikrbxv.supabase.co/', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlYXl0aXB0aWhjYXhsaWtyYnh2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1ODA1MCwiZXhwIjoyMDg4NDM0MDUwfQ.hSEpDC5pIqoGMVdtZBvhfRWVF_7jdRBfJb_QUBzVo3E');

(async () => {
  const { data: skills, error: sErr } = await supabase.from('skills').select('*').limit(5);
  const { data: empSkills, error: esErr } = await supabase.from('employee_skills').select('*').limit(5);
  const { data: memories, error: mErr } = await supabase.from('memory_items').select('*').limit(5);

  console.log('SKILLS:', JSON.stringify(skills, null, 2));
  console.log('EMP_SKILLS:', JSON.stringify(empSkills, null, 2));
  console.log('MEMORY_ITEMS:', JSON.stringify(memories, null, 2));
})();
