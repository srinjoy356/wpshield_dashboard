const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://awyihjjjlnqbhccmfsoa.supabase.co';
const supabaseKey = 'sb_secret_v4-mi3YTAVzny1XGH3jnUw_hYj2tUpW'; // SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanUp() {
  try {
    console.log("Fetching users...");
    // 1. Delete the user
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;
    
    const user = usersData.users.find(u => u.email?.toLowerCase() === 'srinjoy@cybernara.com'.toLowerCase());
    if (user) {
      console.log(`Found user ${user.email} (ID: ${user.id}). Deleting...`);
      const { error: delUserError } = await supabase.auth.admin.deleteUser(user.id);
      if (delUserError) throw delUserError;
      console.log("User deleted successfully.");
    } else {
      console.log("User srinjoy@cybernara.com not found in auth.");
    }

    // 2. Delete the profile just in case (though cascade should handle it)
    await supabase.from('user_profiles').delete().ilike('email', 'srinjoy@cybernara.com');

    // 3. Delete any companies related to srinjoy or mediagully
    console.log("Finding companies to delete...");
    const { data: companies, error: compError } = await supabase
      .from('companies')
      .select('id, company_id')
      .or('contact_email.ilike.%srinjoy@cybernara.com%,display_name.ilike.%mediagully%');
      
    if (compError) throw compError;
    
    if (companies && companies.length > 0) {
      for (const comp of companies) {
        console.log(`Deleting company ${comp.company_id}...`);
        
        // Find all profiles for this company
        const { data: profiles } = await supabase.from('user_profiles').select('id').eq('company_id', comp.company_id);
        if (profiles && profiles.length > 0) {
          for (const profile of profiles) {
            console.log(`Deleting activity logs and auth user for profile ${profile.id}...`);
            await supabase.from('activity_logs').delete().eq('actor_id', profile.id);
            await supabase.auth.admin.deleteUser(profile.id);
          }
        }
        
        // Also delete activity logs targeting this company
        await supabase.from('activity_logs').delete().eq('target_company_id', comp.company_id);

        const { error: delCompError } = await supabase.from('companies').delete().eq('id', comp.id);
        if (delCompError) console.error("Error deleting company:", delCompError);
        else console.log(`Deleted company ${comp.company_id}`);
      }
    } else {
      console.log("No related companies found.");
    }

    // 4. Delete any sites related to mediagully just in case they were orphaned
    console.log("Finding orphaned sites...");
    const { data: sites, error: sitesError } = await supabase
      .from('sites')
      .select('id, url')
      .ilike('url', '%mediagully%');
      
    if (sitesError) throw sitesError;
    
    if (sites && sites.length > 0) {
      for (const site of sites) {
        console.log(`Deleting site ${site.url}...`);
        await supabase.from('sites').delete().eq('id', site.id);
      }
    }

    console.log("Cleanup complete!");
  } catch (err) {
    console.error("Cleanup failed:", err);
  }
}

cleanUp();
