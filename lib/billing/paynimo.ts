import crypto from 'crypto';

function getKey(): string {
  const key = process.env.PAYNIMO_ENCRYPTION_KEY;
  if (!key) throw new Error('PAYNIMO_ENCRYPTION_KEY is required');
  return key;
}

function getMerchant(): string {
  const code = process.env.PAYNIMO_MERCHANT_CODE;
  if (!code) throw new Error('PAYNIMO_MERCHANT_CODE is required');
  return code;
}

const SCHEME_CODE = process.env.PAYNIMO_SCHEME_CODE || 'FIRST';

export class Paynimo {
  static generateCheckoutToken(
    txnRefNo: string, amount: number, consumerId: string,
    customerEmail: string, customerMobile: string,
  ) {
    const key = getKey();
    const merchantCode = getMerchant();
    const rawData = [
      merchantCode, txnRefNo, amount.toString(), '',
      consumerId, customerMobile, customerEmail,
      '', '', '', '', '', '', '', '', '', key
    ].join('|');
    return crypto.createHash('sha512').update(rawData).digest('hex').toLowerCase();
  }

  static verifyResponseHash(responseString: string): boolean {
    const key = getKey();
    const parts = responseString.split('|');
    if (parts.length < 16) return false;
    const receivedHash = parts.pop();
    const rawData = parts.join('|') + '|' + key;
    const calculatedHash = crypto.createHash('sha512').update(rawData).digest('hex').toLowerCase();
    return receivedHash?.toLowerCase() === calculatedHash;
  }

  static getMerchantCode() { return getMerchant(); }
  static getSchemeCode()   { return SCHEME_CODE; }
}