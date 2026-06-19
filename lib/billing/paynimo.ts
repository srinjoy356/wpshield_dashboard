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

  /**
   * RG-08: Paynimo's "Offline Verification" (requestType "O") — the documented
   * mechanism for checking a transaction's status when the merchant never
   * received a final success/fail callback. Used by the reconciliation cron
   * to recover stuck pending_checkouts rather than leaving them pending forever.
   *
   * API contract per Paynimo's own docs (paynimocheckout/docs, "Offline
   * Verification" section) — not guessed:
   *   POST https://securepg.paynimo.com/api/paynimoV2.req
   *   { merchant: { identifier }, transaction: { deviceIdentifier: "S",
   *     currency: "INR", identifier: <merchant txn ref>,
   *     dateTime: "DD-MM-YYYY", requestType: "O" } }
   *
   * Returns the raw paymentTransaction object (statusCode 0300=success,
   * 0399=failure, 0398=initiated, 0396=awaited, 0392=aborted) — the caller
   * decides what to do with each status, this just performs the lookup.
   *
   * Note: Paynimo's public docs don't show any additional authentication
   * header beyond the merchant identifier in the body for this server-to-
   * server endpoint. If your Paynimo account requires IP allowlisting or an
   * additional API key for this specific call, that has to come from your
   * Paynimo account manager — it isn't something derivable from the public
   * docs, and this implementation can't guess credentials that don't exist
   * anywhere in this codebase.
   */
  static async checkTransactionStatus(merchantTxnRef: string, txnDate: Date): Promise<{
    statusCode: string;
    statusMessage: string;
    amount: string | null;
    bankReferenceId: string | null;
    raw: any;
  } | null> {
    const merchantCode = getMerchant();
    const dd = String(txnDate.getDate()).padStart(2, '0');
    const mm = String(txnDate.getMonth() + 1).padStart(2, '0');
    const yyyy = txnDate.getFullYear();

    const body = {
      merchant: { identifier: merchantCode },
      transaction: {
        deviceIdentifier: 'S',
        currency: 'INR',
        identifier: merchantTxnRef,
        dateTime: `${dd}-${mm}-${yyyy}`,
        requestType: 'O',
      },
    };

    try {
      const res = await fetch('https://securepg.paynimo.com/api/paynimoV2.req', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        console.error(`[Paynimo.checkTransactionStatus] HTTP ${res.status} for ${merchantTxnRef}`);
        return null;
      }

      const json = await res.json();
      const txn = json?.paymentMethod?.paymentTransaction;
      if (!txn) {
        console.error(`[Paynimo.checkTransactionStatus] Unexpected response shape for ${merchantTxnRef}:`, JSON.stringify(json).slice(0, 500));
        return null;
      }

      return {
        statusCode: txn.statusCode,
        statusMessage: txn.statusMessage,
        amount: txn.amount ?? null,
        bankReferenceId: txn.bankReferenceIdentifier ?? null,
        raw: json,
      };
    } catch (err: any) {
      console.error(`[Paynimo.checkTransactionStatus] Request failed for ${merchantTxnRef}:`, err.message);
      return null;
    }
  }
}