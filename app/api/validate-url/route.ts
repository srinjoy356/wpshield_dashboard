import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    try {
      // Create a URL object to validate format
      const parsedUrl = new URL(url);
      
      // Ping the URL
      const response = await fetch(parsedUrl.toString(), {
        method: "HEAD", // Just fetch headers to be fast
        headers: { "User-Agent": "WPShield-Validator/1.0" },
        // Short timeout
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        return NextResponse.json({ success: true, status: response.status });
      } else {
        return NextResponse.json({ success: false, status: response.status, error: "Non-200 response" });
      }
    } catch (fetchErr: any) {
      return NextResponse.json({ success: false, error: fetchErr.message || "Unreachable" });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
