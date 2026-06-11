import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createClient();
    
    // Test database connection with a simple query
    const startTime = Date.now();
    const { error } = await supabase.from("companies").select("id").limit(1);
    const latency = Date.now() - startTime;

    if (error) {
      return NextResponse.json({
        status: "unhealthy",
        database: "error",
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      latency_ms: latency,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return NextResponse.json({
      status: "unhealthy",
      error: err.message || "Internal server error"
    }, { status: 500 });
  }
}
