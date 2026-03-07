import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
const supabaseUrl = process.env.SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy";
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from("profiles").select("*").limit(1);
  console.log("Error:", error);
  console.log("Data:", data);
}
run();
