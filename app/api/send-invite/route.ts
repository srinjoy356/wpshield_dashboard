import { NextResponse } from "next/server";
import { sendEmailViaGraph } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const { company_id, email } = await request.json();

    if (!company_id || !email) {
      return NextResponse.json({ error: "company_id and email are required" }, { status: 400 });
    }

    const subject = "Welcome to WPShield Dashboard";
    const htmlContent = `
      <h2>Welcome to WPShield!</h2>
      <p>Your account has been created for company ID: <strong>${company_id}</strong></p>
      <p>Please log in using this email address.</p>
      <p>If you don't know your password, please contact your administrator or use the 'Forgot Password' link.</p>
    `;

    const success = await sendEmailViaGraph(email, subject, htmlContent);

    if (!success) {
      return NextResponse.json({ error: "Failed to send invite email" }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Invite API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}