import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    )

    const { company_id, email } = await req.json()

    if (!company_id || !email) {
      throw new Error('company_id and email are required')
    }

    // 1. Invalidate existing unused tokens
    await supabaseClient
      .from('client_invitations')
      .update({ expires_at: new Date().toISOString() })
      .eq('company_id', company_id)
      .is('used_at', null)

    // 2. Create new invitation token
    const { data: inviteData, error: inviteError } = await supabaseClient
      .from('client_invitations')
      .insert({
        company_id,
        email,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
      .select('token')
      .single()

    if (inviteError) throw inviteError

    const token = inviteData.token
    const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:3000'
    const inviteUrl = `${siteUrl}/set-password?token=${token}`

    // 3. Check if user already exists in Supabase Auth
    const { data: { users }, error: listError } = await supabaseClient.auth.admin.listUsers()
    if (listError) throw listError

    const userExists = users.some((u: any) => u.email === email)

    if (!userExists) {
      const { error: createError } = await supabaseClient.auth.admin.createUser({
        email,
        email_confirm: true
      })
      if (createError) throw createError
    }

    // 4. Send invite email via O365 SMTP (denomailer)
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.office365.com",
        port: 587,
        tls: false,
        auth: {
          username: Deno.env.get('SMTP_USERNAME') ?? '',
          password: Deno.env.get('SMTP_PASSWORD') ?? '',
        }
      }
    })

    await client.send({
      from: Deno.env.get('SMTP_USERNAME') ?? '',
      to: email,
      subject: "You're invited to WPShield — Cybernara",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Welcome to WPShield</h2>
          <p>You've been invited to access your WPShield dashboard by Cybernara.</p>
          <p>Click the button below to set your password and get started:</p>
          <a href="${inviteUrl}" 
             style="display: inline-block; background-color: #0066cc; color: white; 
                    padding: 12px 24px; text-decoration: none; border-radius: 6px; 
                    margin: 16px 0;">
            Set My Password
          </a>
          <p style="color: #666; font-size: 14px;">This link expires in 24 hours.</p>
          <p style="color: #666; font-size: 14px;">If you didn't expect this email, you can safely ignore it.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
          <p style="color: #999; font-size: 12px;">© Cybernara - WPShield 2026</p>
        </div>
      `,
    })

    await client.close()

    // 5. Update company status to invited
    await supabaseClient
      .from('companies')
      .update({ status: 'invited' })
      .eq('company_id', company_id)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})