const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

function getEnv(key) {
  const envPath = path.join(__dirname, "..", ".env.local");
  const envFile = fs.readFileSync(envPath, "utf8");
  const lines = envFile.split("\n");
  for (const line of lines) {
    if (line.startsWith(`${key}=`)) {
      return line.split("=")[1].trim();
    }
  }
  return null;
}

const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Error listing users:", error);
    return;
  }
  console.log("Users in Auth:");
  data.users.forEach(u => console.log(`- ${u.email} (${u.id})`));

  const { data: profiles, error: pError } = await supabase
    .from("user_profiles")
    .select("*");
  if (pError) {
    console.error("Error fetching profiles:", pError);
  } else {
    console.log("\nUser Profiles:");
    console.table(profiles);
  }
}

checkUser();
