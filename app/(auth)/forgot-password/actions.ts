"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmailViaGraph } from "@/lib/email";

export async function sendResetLink(formData: FormData) {
  const email = formData.get("email") as string;
  if (!email) return { success: false, error: "Email is required." };

  try {
    const adminSupabase = createAdminClient();

    // Check if user exists first to prevent leaking, wait, usually you don't want to leak if a user exists.
    // But generating a link will just fail if user doesn't exist. Let's just generate the link.
    const { data, error } = await adminSupabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auth/callback?next=/reset-password`
      }
    });

    if (error) {
      console.error("Generate link error:", error);
      // Mask the error to avoid email enumeration
      return { success: true };
    }

    if (data?.properties?.action_link) {
      const actionUrl = new URL(data.properties.action_link);
      const token = actionUrl.searchParams.get("token");
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      
      const resetUrl = `${siteUrl}/api/auth/callback?token_hash=${token}&type=recovery&next=/reset-password`;
      
      console.log("\n=======================================================");
      console.log("PASSWORD RESET LINK GENERATED:");
      console.log(resetUrl);
      console.log("=======================================================\n");
      
      
      const emailHtml = `
        <h2>Password Reset Request</h2>
        <p>Hello,</p>
        <p>We received a request to reset your password for Cybernara WPShield.</p>
        <p>Please click the link below to set a new password:</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background-color:#0D9488;color:#fff;text-decoration:none;border-radius:5px;">Reset Password</a></p>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <br/>
        <p>Best regards,<br/>Cybernara Team</p>
      `;

      await sendEmailViaGraph(
        email,
        "Reset your WPShield Password",
        emailHtml
      );
    }

    return { success: true };
  } catch (err) {
    console.error("Forgot password error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}
