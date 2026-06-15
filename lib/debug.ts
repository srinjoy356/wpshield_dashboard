// lib/debug.ts
// Debug logging utility — only logs when NEXT_PUBLIC_DEBUG=true
// Set NEXT_PUBLIC_DEBUG=true in .env.local for local development
// Never set it in production Render env vars

const DEBUG = process.env.NEXT_PUBLIC_DEBUG === 'true';

export const debug = {
  log:  (...args: any[]) => { if (DEBUG) console.log(...args); },
  warn: (...args: any[]) => { if (DEBUG) console.warn(...args); },
};