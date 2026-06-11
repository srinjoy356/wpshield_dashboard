import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
const projectDir = process.cwd();
loadEnvConfig(projectDir);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seedInventory() {
  const companyId = "mediagullydigitalmarketingagency";

  const corePayload = {
    wp_version: "6.4.2",
    php_version: "8.1.0",
    db_version: "10.6.14-MariaDB",
  };

  const pluginsPayload = {
    count: 2,
    plugins: [
      {
        name: "Classic Editor",
        slug: "classic-editor",
        version: "1.6.3",
        is_active: true,
        update_pending: false,
      },
      {
        name: "WooCommerce",
        slug: "woocommerce",
        version: "8.4.0",
        is_active: true,
        update_pending: true,
        new_version: "8.5.1",
      },
    ],
  };

  const themesPayload = {
    count: 1,
    themes: [
      {
        name: "Twentytwentyfour",
        slug: "twentytwentyfour",
        version: "1.0",
        is_active: true,
        update_pending: false,
      },
    ],
  };

  const timestamp = new Date().toISOString();

  const { error: coreError } = await supabase
    .from("wpshield_inventory_snapshots")
    .insert({ company_id: companyId, site_url: "https://example.com", kind: "core", payload: JSON.stringify(corePayload), occurred_at: timestamp });

  const { error: pluginsError } = await supabase
    .from("wpshield_inventory_snapshots")
    .insert({ company_id: companyId, site_url: "https://example.com", kind: "plugins", payload: JSON.stringify(pluginsPayload), occurred_at: timestamp });

  const { error: themesError } = await supabase
    .from("wpshield_inventory_snapshots")
    .insert({ company_id: companyId, site_url: "https://example.com", kind: "themes", payload: JSON.stringify(themesPayload), occurred_at: timestamp });

  if (coreError || pluginsError || themesError) {
    console.error("Errors:", coreError, pluginsError, themesError);
  } else {
    console.log("Successfully seeded mock inventory data for", companyId);
  }

  // Add a fake vulnerability alert for WooCommerce
  const { error: vulnError } = await supabase
    .from("wpshield_vuln_alerts")
    .insert({
      company_id: companyId,
      plugin_slug: "woocommerce",
      plugin_name: "WooCommerce",
      vulnerability_type: "Cross-Site Scripting (XSS)",
      severity: "high",
      status: "open",
      created_at: timestamp,
    });

  if (vulnError) {
    console.error("Vuln error:", vulnError);
  } else {
    console.log("Successfully seeded mock vulnerability alert.");
  }
}

seedInventory();
