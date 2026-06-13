import crypto from 'crypto';

function getKey(): string {
  const key = process.env.WORLDLINE_SALT;
  if (!key) throw new Error('WORLDLINE_SALT is required');
  return key;
}

function getMerchant(): string {
  const code = process.env.WORLDLINE_MERCHANT_ID;
  if (!code) throw new Error('WORLDLINE_MERCHANT_ID is required');
  return code;
}

const SCHEME_CODE = process.env.SCHEME_CODE || 'FIRST';

export class Paynimo {
  static generateCheckoutToken(
    txnRefNo: string, amount: number, consumerId: string,
    customerEmail: string, customerMobile: string,
  ) {
    const key          = getKey();
    const merchantCode = getMerchant();
    const rawData = [
      merchantCode, txnRefNo, amount.toString(), '',
      consumerId, customerMobile, customerEmail,
      '', '', '', '', '', '', '', '', '', key
    ].join('|');
    return crypto.createHash('sha512').update(rawData).digest('hex').toLowerCase();
  }

  static verifyResponseHash(responseString: string): boolean {
    const key   = getKey();
    const parts = responseString.split('|');
    if (parts.length < 16) return false;
    const receivedHash  = parts.pop();
    const rawData       = parts.join('|') + '|' + key;
    const calculatedHash = crypto.createHash('sha512').update(rawData).digest('hex').toLowerCase();
    return receivedHash?.toLowerCase() === calculatedHash;
  }

  static getMerchantCode() { return getMerchant(); }
  static getSchemeCode()   { return SCHEME_CODE; }
}