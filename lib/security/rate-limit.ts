/**
 * Rate limiting — disabled for launch.
 *
 * The ingest endpoints receive pre-filtered attack traffic only (PHP
 * pattern matching on the WordPress side means only ~1% of requests
 * ever reach the dashboard). Volume is low enough that rate limiting
 * adds no value at this stage and would require Redis infrastructure.
 *
 * To re-enable: replace this file with the Upstash Redis implementation.
 */
export async function checkRateLimit(
  _identifier: string,
  _limit: number,
  _windowSeconds: number
): Promise<{ success: boolean; retryAfter?: number }> {
  return { success: true };
}
