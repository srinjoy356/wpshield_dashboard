<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Settings storage + data-sharing checklist.
 *
 * Supabase edition: replaces VPS endpoint/site_token with
 * supabase_url and supabase_key (service-role key).
 */
class WPShield_Settings {

    public static function defaults() {
        return array(
            'enabled'        => 0,
            'company_id'     => '',          // populated via activation
            'api_endpoint'   => 'http://localhost:3000', // SaaS API endpoint
            'license_key'    => '',          // from customer portal
            'site_token'     => '',          // from activation
            'flush_interval' => '2min',
            'checklist'      => array(
                'attack_detection' => 1,
                'login_activity'   => 1,
                'file_integrity'   => 1,
                'plugin_health'    => 1,
                'theme_health'     => 1,
                'core_info'        => 1,
                'user_metadata'    => 1,
                'request_headers'  => 1,
                'user_activity'    => 1,
                'malware_scan'     => 1,
            ),
            'batch_size'          => 50,
            'footer_attribution'  => 1,  // pre-checked — security badge in footer
        );
    }

    public static function get() {
        $opts = get_option( WPSHIELD_OPTION_KEY, array() );
        return wp_parse_args( $opts, self::defaults() );
    }

    public static function update( $new ) {
        $clean = self::sanitize( $new );
        update_option( WPSHIELD_OPTION_KEY, $clean );
        return $clean;
    }

    public static function sanitize( $input ) {
        $defaults = self::defaults();
        $clean    = array();

        $clean['enabled']      = ! empty( $input['enabled'] ) ? 1 : 0;
        $clean['company_id']   = isset( $input['company_id'] )   ? sanitize_key( $input['company_id'] )           : '';
        $clean['api_endpoint'] = isset( $input['api_endpoint'] ) ? esc_url_raw( trim( $input['api_endpoint'] ) )  : '';
        $clean['license_key']  = isset( $input['license_key'] )  ? sanitize_text_field( $input['license_key'] )   : '';
        $clean['site_token']   = isset( $input['site_token'] )   ? sanitize_text_field( $input['site_token'] )    : '';
        $clean['batch_size']          = isset( $input['batch_size'] )          ? max( 10, min( 500, (int) $input['batch_size'] ) ) : 50;
        $clean['footer_attribution']  = ! empty( $input['footer_attribution'] ) ? 1 : 0;

        $allowed_intervals = array( '2min', '5min', '10min', '15min', '30min', '1hr', '2hr', '3hr' );
        $clean['flush_interval'] = ( isset( $input['flush_interval'] ) && in_array( $input['flush_interval'], $allowed_intervals, true ) )
            ? $input['flush_interval'] : '2min';

        $clean['checklist'] = array();
        foreach ( $defaults['checklist'] as $key => $default ) {
            $clean['checklist'][ $key ] = ! empty( $input['checklist'][ $key ] ) ? 1 : 0;
        }

        return $clean;
    }

    public static function is_allowed( $checklist_key ) {
        $s = self::get();
        return ! empty( $s['checklist'][ $checklist_key ] );
    }

    public static function interval_seconds( $key ) {
        $map = array(
            '2min'  => 2  * MINUTE_IN_SECONDS,
            '5min'  => 5  * MINUTE_IN_SECONDS,
            '10min' => 10 * MINUTE_IN_SECONDS,
            '15min' => 15 * MINUTE_IN_SECONDS,
            '30min' => 30 * MINUTE_IN_SECONDS,
            '1hr'   => 1  * HOUR_IN_SECONDS,
            '2hr'   => 2  * HOUR_IN_SECONDS,
            '3hr'   => 3  * HOUR_IN_SECONDS,
        );
        return isset( $map[ $key ] ) ? $map[ $key ] : ( 2 * MINUTE_IN_SECONDS );
    }

    public static function interval_slug( $key ) {
        return 'wpshield_' . preg_replace( '/[^a-z0-9]/', '', strtolower( $key ) );
    }

    public static function interval_label( $key ) {
        $labels = array(
            '2min'  => 'Every 2 minutes (recommended)',
            '5min'  => 'Every 5 minutes',
            '10min' => 'Every 10 minutes',
            '15min' => 'Every 15 minutes',
            '30min' => 'Every 30 minutes',
            '1hr'   => 'Every 1 hour',
            '2hr'   => 'Every 2 hours',
            '3hr'   => 'Every 3 hours',
        );
        return isset( $labels[ $key ] ) ? $labels[ $key ] : $key;
    }

    public static function all_intervals() {
        return array( '2min', '5min', '10min', '15min', '30min', '1hr', '2hr', '3hr' );
    }
}
