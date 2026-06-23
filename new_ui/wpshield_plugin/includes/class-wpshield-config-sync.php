<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class WPShield_Config_Sync {

    public static function init() {
        add_action( 'wpshield_cron_config_sync', array( __CLASS__, 'fetch' ) );
        if ( ! wp_next_scheduled( 'wpshield_cron_config_sync' ) ) {
            wp_schedule_event( time(), 'hourly', 'wpshield_cron_config_sync' );
        }
    }

    public static function get() {
        $cached = get_transient( 'wpshield_remote_config' );
        if ( false !== $cached ) {
            return $cached;
        }
        return self::fetch();
    }

    public static function fetch() {
        $settings = WPShield_Settings::get();

        if ( empty( $settings['api_endpoint'] ) || empty( $settings['site_token'] ) ) {
            return self::default_config();
        }

        $endpoint = rtrim( $settings['api_endpoint'], '/' ) . '/api/site/config';

        $args = array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $settings['site_token'],
                'Accept'        => 'application/json',
            ),
            'timeout' => 10,
        );

        $response = wp_remote_get( $endpoint, $args );

        if ( is_wp_error( $response ) ) {
            return self::default_config();
        }

        $code = wp_remote_retrieve_response_code( $response );
        if ( 200 !== $code ) {
            return self::default_config();
        }

        $body = json_decode( wp_remote_retrieve_body( $response ), true );

        if ( empty( $body['config_json'] ) || empty( $body['signature'] ) ) {
            return self::default_config();
        }

        // Verify the HMAC over the exact string the dashboard signed, not a
        // re-serialization of $body['config'] — PHP's json_encode and JS's
        // JSON.stringify don't escape forward slashes or non-ASCII the same way by
        // default, so re-encoding here could produce different bytes even for
        // identical data and cause a false verification failure (or, worse, if both
        // sides happened to agree on a *wrong* shared assumption, a false pass).
        // Verifying the literal string the dashboard already hashed sidesteps that.
        $expected_signature = hash_hmac( 'sha256', $body['config_json'], $settings['site_token'] );
        if ( ! hash_equals( $expected_signature, $body['signature'] ) ) {
            error_log( '[WPShield] Config signature verification failed — discarding remote config.' );
            return self::default_config();
        }

        $config = json_decode( $body['config_json'], true );
        if ( ! is_array( $config ) ) {
            return self::default_config();
        }

        // Freshness check — a response older than its own stated expiry shouldn't be
        // trusted even if the signature is valid (e.g. a cached/replayed response from
        // a misconfigured intermediary). Tolerate a little clock drift between this
        // server and the dashboard rather than rejecting on a few seconds' difference.
        if ( ! empty( $config['expires_at'] ) ) {
            $expires_ts = strtotime( $config['expires_at'] );
            if ( $expires_ts && $expires_ts < ( time() - 300 ) ) {
                error_log( '[WPShield] Remote config has expired — discarding.' );
                return self::default_config();
            }
        }

        set_transient( 'wpshield_remote_config', $config, 15 * MINUTE_IN_SECONDS );

        return $config;
    }

    private static function default_config() {
        return array(
            'blocking_enabled'   => false,
            'blocked_countries'  => array(),
            'maintenance_mode'   => false,
            'away_mode_schedule' => null,
            'footer_attribution' => true,
            'is_premium'         => false,
        );
    }
}
