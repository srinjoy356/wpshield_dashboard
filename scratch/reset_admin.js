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

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetAdmin() {
  const email = "admin@wpshield.com";
  const { data, error } = await supabase.auth.admin.listUsers();
  const user = data.users.find(u => u.email === email);

  if (user) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: "password123"
    });
    if (updateError) console.error("Error updating password:", updateError);
    else console.log(`Password for ${email} reset to: password123`);
  } else {
    console.log("Admin user not found.");
  }
}

resetAdmin();
