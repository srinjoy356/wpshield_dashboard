import dns from 'dns';
import { promisify } from 'util';

const lookup = promisify(dns.lookup);

const FORBIDDEN_IPS = [
  /^127\./,           // localhost
  /^10\./,            // private class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // private class B
  /^192\.168\./,      // private class C
  /^169\.254\./,      // link-local (cloud metadata)
  /^0\./,             // current network
];

function isForbiddenIP(ip: string): boolean {
  if (process.env.NODE_ENV === 'development') return false;
  if (ip === '::1') return true;
  return FORBIDDEN_IPS.some(regex => regex.test(ip));
}

export async function safeFetch(url: string, options?: RequestInit): Promise<Response> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch (err) {
    throw new Error('Invalid URL');
  }

  // Only allow HTTP/HTTPS
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`SSRF Blocked: Invalid protocol ${parsedUrl.protocol}`);
  }

  // Resolve hostname to IP
  const { address } = await lookup(parsedUrl.hostname);
  if (isForbiddenIP(address)) {
    throw new Error(`SSRF Blocked: IP ${address} is forbidden`);
  }

  return fetch(url, options);
}
