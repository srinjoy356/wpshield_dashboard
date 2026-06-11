import { Paynimo } from '../lib/billing/paynimo';

async function simulateSuccess(userId, planCode, amount, customerEmail) {
  const txnRefNo = `TXN_${Date.now()}`;
  const tpslTxnId = `TPSL_${Date.now()}`;
  
  // Create a fake success message
  // txn_status|txn_msg|txn_err_msg|clnt_txn_ref|tpsl_bank_cd|tpsl_txn_id|txn_amt|clnt_rqst_meta|tpsl_txn_time|bal_amt|card_id|alias_name|BankTransactionID|mandate_reg_no|token|hash
  const rawMsg = [
    '0300', // authStatus
    'Transaction Successful', // authMsg
    '', // txn_err_msg
    txnRefNo, // clnt_txn_ref
    'TEST_BANK', // tpsl_bank_cd
    tpslTxnId, // tpsl_txn_id
    amount.toFixed(2), // txn_amt
    '', // clnt_rqst_meta
    new Date().toISOString(), // tpsl_txn_time
    '', // bal_amt
    '', // card_id
    '', // alias_name
    'BANK_12345', // BankTransactionID
    '', // mandate_reg_no
    'token123' // token
  ].join('|');

  // Generate dual hash
  const crypto = require('crypto');
  const PAYNIMO_KEY = '3263390563ABSQUR';
  const rawDataForHash = rawMsg + '|' + PAYNIMO_KEY;
  const hash = crypto.createHash('sha512').update(rawDataForHash).digest('hex').toLowerCase();
  
  const finalMsg = rawMsg + '|' + hash;

  console.log("Simulating POST to return URL...");
  
  const returnUrl = `http://localhost:3000/api/billing/paynimo-return?user_id=${encodeURIComponent(userId)}&plan_code=${encodeURIComponent(planCode)}`;
  
  const formData = new URLSearchParams();
  formData.append('msg', finalMsg);

  const res = await fetch(returnUrl, {
    method: 'POST',
    body: formData,
    redirect: 'manual'
  });

  console.log("Status:", res.status);
  console.log("Location:", res.headers.get('location'));
}

// Replace with the actual user ID from the database
const USER_ID = "replace_with_user_id"; 
const PLAN_CODE = "test_plan_code";
const AMOUNT = 5.00;
const EMAIL = "test@example.com";

// simulateSuccess(USER_ID, PLAN_CODE, AMOUNT, EMAIL);
