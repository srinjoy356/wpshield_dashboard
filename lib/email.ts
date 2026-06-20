export async function sendEmailViaGraph(to: string, subject: string, htmlContent: string, attachments?: { name: string, contentType: string, contentBytes: string }[]) {
  const tenantId = process.env.MICROSOFT_GRAPH_TENANT_ID;
  const clientId = process.env.MICROSOFT_GRAPH_CLIENT_ID;
  const clientSecret = process.env.SECRET_VALUE;
  const mailFrom = process.env.MAIL_FROM;

  if (!tenantId || !clientId || !clientSecret || !mailFrom) {
    console.log("Cron: Missing MS Graph credentials in environment");
    return false;
  }

  // Every caller of this function (license issuance, OTP delivery, reveal/
  // resend emails, etc.) expects a boolean outcome, not an exception — so
  // every failure mode here, including a network timeout, resolves to
  // `return false` rather than throwing. Previously a hung or failed request
  // here would throw an unhandled error up into whichever route called this,
  // and several of those routes had no try/catch of their own, which could
  // surface as the calling feature appearing to hang indefinitely from the
  // browser's perspective instead of failing with a clear error.
  try {
    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        scope: 'https://graph.microsoft.com/.default',
        client_secret: clientSecret,
        grant_type: 'client_credentials'
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.log("Cron: Graph API token fetch failed:", errorText);
      return false;
    }
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const message: any = {
      subject: subject,
      body: { contentType: 'HTML', content: htmlContent },
      toRecipients: [{ emailAddress: { address: to } }]
    };

    if (attachments && attachments.length > 0) {
      message.attachments = attachments.map(att => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: att.name,
        contentType: att.contentType,
        contentBytes: att.contentBytes
      }));
    }

    const sendRes = await fetch(`https://graph.microsoft.com/v1.0/users/${mailFrom}/sendMail`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        saveToSentItems: 'false'
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!sendRes.ok) {
      const errorText = await sendRes.text();
      console.log("Cron: Graph API send email failed:", errorText);
    }

    return sendRes.ok;
  } catch (err: any) {
    console.error("sendEmailViaGraph failed:", err.name, err.message);
    return false;
  }
}