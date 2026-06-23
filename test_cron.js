const https = require('https');

https.get('https://wpshield-dashboard.onrender.com/api/cron/auto-update', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response Body:', data);
  });
}).on('error', (err) => {
  console.log('Error:', err.message);
});
