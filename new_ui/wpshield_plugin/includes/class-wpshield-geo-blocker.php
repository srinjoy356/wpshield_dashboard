<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * WPShield Geo Blocker
 *
 * Blocks requests from countries in the blocked_countries list.
 * Uses the X-Country-Code header set by Cloudflare (CF-IPCountry)
 * or falls back to a lightweight MaxMind-free lookup if available.
 *
 * PREMIUM ONLY — is_premium must be true in config for geo blocking to activate.
 */
class WPShield_Geo_Blocker {

    public function __construct() {
        add_action( 'init', array( $this, 'check_country' ), 2 );
    }

    public function check_country() {
        if ( wp_doing_cron() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
            return;
        }

        $config = WPShield_Config_Sync::get();

        // Gate: geo blocking is a premium feature
        if ( empty( $config['is_premium'] ) ) {
            return;
        }

        $blocked_countries = isset( $config['blocked_countries'] ) ? (array) $config['blocked_countries'] : array();
        if ( empty( $blocked_countries ) ) {
            return;
        }

        $country_code = $this->get_country_code();
        if ( empty( $country_code ) ) {
            return; // Can't determine — fail open (don't block)
        }

        if ( in_array( strtoupper( $country_code ), array_map( 'strtoupper', $blocked_countries ), true ) ) {
            status_header( 403 );
            header( 'Content-Type: text/html; charset=utf-8' );
            ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Access Restricted</title>
    <style>
        body { font-family: sans-serif; background: #f9fafb; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .box { text-align: center; padding: 40px; }
        h1 { color: #0a6358; }
        p { color: #6b7280; }
    </style>
</head>
<body>
    <div class="box">
        <h1>Access Restricted</h1>
        <p>This site is not available in your region.</p>
    </div>
</body>
</html>
            <?php
            exit;
        }
    }

    private function get_country_code() {
        // Cloudflare sets this header — most reliable if behind CF
        if ( ! empty( $_SERVER['HTTP_CF_IPCOUNTRY'] ) ) {
            return sanitize_text_field( $_SERVER['HTTP_CF_IPCOUNTRY'] );
        }

        // Some other proxies/CDNs set this
        if ( ! empty( $_SERVER['HTTP_X_COUNTRY_CODE'] ) ) {
            return sanitize_text_field( $_SERVER['HTTP_X_COUNTRY_CODE'] );
        }

        // No country header available — return null (fail open)
        return null;
    }
}
