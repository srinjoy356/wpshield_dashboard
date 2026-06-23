<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Local queue writer.
 *
 * All collectors funnel events through here. Nothing is sent synchronously;
 * the cron-driven Transmitter flushes the queue to the VPS in batches.
 * This guarantees zero impact on page load even if the VPS is unreachable.
 */
class WPShield_Logger {

    /**
     * Push an event into the outbound queue.
     *
     * @param string $type     attack|login|file|health
     * @param string $severity low|medium|high|critical
     * @param array  $data     event-specific payload
     */
    public static function log( $type, $severity, array $data ) {
        global $wpdb;

        $settings = WPShield_Settings::get();
        if ( empty( $settings['enabled'] ) ) {
            return;
        }

        // Strip request headers unless explicitly allowed.
        if ( empty( $settings['checklist']['request_headers'] ) ) {
            unset( $data['headers'] );
        }
        // Strip user metadata unless explicitly allowed.
        if ( empty( $settings['checklist']['user_metadata'] ) ) {
            unset( $data['user_email'], $data['display_name'] );
        }

        $payload = array(
            'company_id' => $settings['company_id'],
            'site_url'   => home_url(),
            'event_type' => $type,
            'severity'   => $severity,
            'occurred_at'=> gmdate( 'Y-m-d H:i:s' ),
            'data'       => $data,
        );

        $wpdb->insert(
            $wpdb->prefix . WPSHIELD_QUEUE_TABLE,
            array(
                'event_type' => $type,
                'severity'   => $severity,
                'payload'    => wp_json_encode( $payload ),
                'status'     => 'pending',
                'created_at' => current_time( 'mysql', true ),
            ),
            array( '%s', '%s', '%s', '%s', '%s' )
        );
    }

    /**
     * Anonymize/normalize an IP address for storage.
     */
    public static function client_ip() {
        $candidates = array( 'HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR' );
        foreach ( $candidates as $key ) {
            if ( ! empty( $_SERVER[ $key ] ) ) {
                $ip = explode( ',', $_SERVER[ $key ] )[0];
                $ip = trim( $ip );
                if ( filter_var( $ip, FILTER_VALIDATE_IP ) ) {
                    return $ip;
                }
            }
        }
        return '0.0.0.0';
    }
}
