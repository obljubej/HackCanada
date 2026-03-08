const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://reaytiptihcaxlikrbxv.supabase.co/',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlYXl0aXB0aWhjYXhsaWtyYnh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NTgwNTAsImV4cCI6MjA4ODQzNDA1MH0.op5GWDKdHe1uT3HcdPvPQeCauf1L2Fr1HysAuo76JIc'
);

async function run() {
  const { data: profiles } = await supabase.from('profiles').select('*').limit(1);
  const profileId = profiles[0].id;
  
  const { data: project } = await supabase.from('projects').insert({
    title: 'Test Project',
    description: 'Testing',
    status: 'planning',
  }).select().single();
  
  const projectId = project.id;
  console.log('Project ID:', projectId, 'Profile ID:', profileId);

  const { data: assignment, error } = await supabase.from("project_assignments").upsert({
    project_id: projectId,
    employee_id: profileId,
    role: "Test Role"
  });

  console.log('Assignment:', assignment, 'Error:', error);
}
run();
