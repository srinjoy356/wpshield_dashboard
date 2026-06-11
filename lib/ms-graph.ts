export async function sendEmailViaGraph(to: string, subject: string, htmlContent: string) {
  const tenantId = process.env.MICROSOFT_GRAPH_TENANT_ID;
  const clientId = process.env.MICROSOFT_GRAPH_CLIENT_ID;
  const clientSecret = process.env.SECRET_VALUE;
  const mailFrom = process.env.MAIL_FROM;

  if (!tenantId || !clientId || !clientSecret || !mailFrom) {
    console.error("Missing MS Graph credentials in environment");
    return false;
  }

  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      scope: 'https://graph.microsoft.com/.default',
      client_secret: clientSecret,
      grant_type: 'client_credentials'
    })
  });
  
  if (!tokenRes.ok) {
      console.error("MS Graph Token Error:", await tokenRes.text());
      return false;
  }
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  const sendRes = await fetch(`https://graph.microsoft.com/v1.0/users/${mailFrom}/sendMail`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        subject: subject,
        body: { contentType: 'HTML', content: htmlContent },
        toRecipients: [{ emailAddress: { address: to } }]
      },
      saveToSentItems: 'false'
    })
  });

  if (!sendRes.ok) {
      console.error("MS Graph Send Error:", await sendRes.text());
  }

  return sendRes.ok;
}
