import { createClient } from "@/lib/supabase/server";
import { getActivityLogs } from "@/lib/queries/activity";
import { ActivityClient } from "./components/ActivityClient";

export default async function ActivityPage() {
  const supabase = createClient();
  const activityLogs = await getActivityLogs(supabase, { limit: 100 });

  return <ActivityClient initialLogs={activityLogs} />;
}
