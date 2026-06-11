import crypto from 'crypto';

const PAYNIMO_KEY = process.env.PAYNIMO_ENCRYPTION_KEY || '3263390563ABSQUR';
const PAYNIMO_IV = process.env.PAYNIMO_ENCRYPTION_IV || '1795741705BSBNMM';
const MERCHANT_CODE = process.env.PAYNIMO_MERCHANT_CODE || 'T1092238';
const SCHEME_CODE = process.env.PAYNIMO_SCHEME_CODE || 'FIRST';

export class Paynimo {
  /**
   * Generates the SHA-512 token for Checkout JS integration
   */
  static generateCheckoutToken(
    txnRefNo: string,
    amount: number,
    consumerId: string,
    customerEmail: string,
    customerMobile: string,
  ) {
    const SALT = PAYNIMO_KEY; // The provided 'Encryption Key' is the SALT
    
    // Checkout JS hash format:
    // merchantId|txnId|amount|accountNo|consumerId|consumerMobileNo|consumerEmailId|debitStartDate|debitEndDate|maxAmount|amountType|frequency|cardNumber|expMonth|expYear|cvvCode|SALT
    const rawData = [
      MERCHANT_CODE,
      txnRefNo,
      amount.toString(),
      '', // accountNo
      consumerId,
      customerMobile,
      customerEmail,
      '', // debitStartDate
      '', // debitEndDate
      '', // maxAmount
      '', // amountType
      '', // frequency
      '', // cardNumber
      '', // expMonth
      '', // expYear
      '', // cvvCode
      SALT
    ].join('|');

    return crypto.createHash('sha512').update(rawData).digest('hex').toLowerCase();
  }

  static verifyResponseHash(responseString: string): boolean {
    // Response string format from webhook:
    // txn_status|txn_msg|txn_err_msg|clnt_txn_ref|tpsl_bank_cd|tpsl_txn_id|txn_amt|clnt_rqst_meta|tpsl_txn_time|bal_amt|card_id|alias_name|BankTransactionID|mandate_reg_no|token|hash
    const parts = responseString.split('|');
    if (parts.length < 16) return false;
    
    const receivedHash = parts.pop(); // Remove the hash from the end
    const rawData = parts.join('|') + '|' + PAYNIMO_KEY; // Rejoin and add SALT
    
    const calculatedHash = crypto.createHash('sha512').update(rawData).digest('hex').toLowerCase();
    
    return receivedHash?.toLowerCase() === calculatedHash;
  }

  static getMerchantCode() {
    return MERCHANT_CODE;
  }
}
