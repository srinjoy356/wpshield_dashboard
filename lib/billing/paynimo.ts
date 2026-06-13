import crypto from 'crypto';

if (!process.env.PAYNIMO_ENCRYPTION_KEY) throw new Error('PAYNIMO_ENCRYPTION_KEY is required');
if (!process.env.PAYNIMO_MERCHANT_CODE)  throw new Error('PAYNIMO_MERCHANT_CODE is required');

const PAYNIMO_KEY   = process.env.PAYNIMO_ENCRYPTION_KEY;
const MERCHANT_CODE = process.env.PAYNIMO_MERCHANT_CODE;
const SCHEME_CODE   = process.env.PAYNIMO_SCHEME_CODE || 'FIRST';

export class Paynimo {
  static generateCheckoutToken(
    txnRefNo: string, amount: number, consumerId: string,
    customerEmail: string, customerMobile: string,
  ) {
    const rawData = [
      MERCHANT_CODE, txnRefNo, amount.toString(), '',
      consumerId, customerMobile, customerEmail,
      '', '', '', '', '', '', '', '', '', PAYNIMO_KEY
    ].join('|');
    return crypto.createHash('sha512').update(rawData).digest('hex').toLowerCase();
  }

  static verifyResponseHash(responseString: string): boolean {
    const parts = responseString.split('|');
    if (parts.length < 16) return false;
    const receivedHash = parts.pop();
    const rawData = parts.join('|') + '|' + PAYNIMO_KEY;
    const calculatedHash = crypto.createHash('sha512').update(rawData).digest('hex').toLowerCase();
    return receivedHash?.toLowerCase() === calculatedHash;
  }

  static getMerchantCode() { return MERCHANT_CODE; }
  static getSchemeCode()   { return SCHEME_CODE; }
}