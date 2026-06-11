const crypto = require('crypto');

const PAYNIMO_KEY = '3263390563ABSQUR';
const PAYNIMO_IV = '1795741705BSBNMM';
const MERCHANT_CODE = 'T1092238';
const SCHEME_CODE = 'FIRST';

function encryptHex(text) {
    const cipher = crypto.createCipheriv('aes-128-cbc', PAYNIMO_KEY, PAYNIMO_IV);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted; // usually uppercase or lowercase?
}

async function testPayload(payloadStr, isHex) {
    let encrypted;
    if (isHex) {
        encrypted = encryptHex(payloadStr);
    } else {
        const cipher = crypto.createCipheriv('aes-128-cbc', PAYNIMO_KEY, PAYNIMO_IV);
        encrypted = cipher.update(payloadStr, 'utf8', 'base64');
        encrypted += cipher.final('base64');
    }

    const formData = new URLSearchParams();
    formData.append('reqType', 'T');
    formData.append('mrctCode', MERCHANT_CODE);
    formData.append('msg', encrypted);

    const res = await fetch('https://www.paynimo.com/api/paynimoV2.req', {
        method: 'POST',
        body: formData
    });
    
    const text = await res.text();
    console.log(`[Payload Length: ${payloadStr.split('|').length}, Type: ${isHex ? 'Hex' : 'Base64'}] -> Response Length: ${text.length}, text: ${text.substring(0, 100)}`);
}

async function run() {
    const txnRefNo = `TXN_${Date.now()}`;
    const date = '10-06-2026';
    const amount = '1.00';
    const customerName = 'Test User';
    const customerEmail = 'test@example.com';
    const customerMobile = '9999999999';
    const returnUrl = 'https://swaddling-stuffed-provoking.ngrok-free.dev/api/billing/paynimo-return';

    // Format 1: 14 parameters (Modern TechProcess Format)
    // MerchantID|TxnRefNo|SchemeCode|TxnAmount|Currency|ReturnUrl|S2SUrl|Filler1|Filler2|Filler3
    const p1 = [
        MERCHANT_CODE, txnRefNo, SCHEME_CODE, amount, 'INR', returnUrl, '', '', '', ''
    ].join('|');
    await testPayload(p1, true);

    // Format 2: 14 parameters (Classic TechProcess Format)
    // MerchantCode|TxnRefNo|PropertyCode|Amount|BankCode|CustName|CustEmail|CustMobile|Currency|ReturnUrl|S2SUrl|Filler1|Filler2|TxnDate
    const p2 = [
        MERCHANT_CODE, txnRefNo, SCHEME_CODE, amount, '', customerName, customerEmail, customerMobile, 'INR', returnUrl, '', '', '', date
    ].join('|');
    await testPayload(p2, true);

    // Format 3: 17 parameters (What we had before)
    const p3 = [
        MERCHANT_CODE, txnRefNo, SCHEME_CODE, amount, '', customerName, customerEmail, customerMobile, 'INR', 'DIRECT', 'R', '', '', '', date, returnUrl, ''
    ].join('|');
    await testPayload(p3, true);
}

run().catch(console.error);
