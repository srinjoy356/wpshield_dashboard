<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * WPShield Active IP Blocker
 *
 * When blocking_enabled = true in config AND the plan is premium,
 * fetches the blocked IPs list from the config and blocks matching requests.
 *
 * PREMIUM ONLY — is_premium must be true in config for blocking to activate.
 * Core plan users always get blocking_enabled = false from the dashboard
 * config route, so this is a belt-and-suspenders check.
 */
class WPShield_Active_Blocker {

    const BLOCKED_IPS_KEY = 'wpshield_blocked_ips_cache';
    const CACHE_TTL       = 10 * MINUTE_IN_SECONDS;

    public function __construct() {
        add_action( 'init', array( $this, 'check_ip' ), 1 );
    }

    public function check_ip() {
        if ( wp_doing_cron() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
            return;
        }

        $config = WPShield_Config_Sync::get();

        // Gate: IP blocking is a premium feature
        if ( empty( $config['is_premium'] ) ) {
            return;
        }

        if ( empty( $config['blocking_enabled'] ) ) {
            return;
        }

        $blocked_ips = isset( $config['blocked_ips'] ) ? (array) $config['blocked_ips'] : array();
        if ( empty( $blocked_ips ) ) {
            return;
        }

        $client_ip = $this->get_client_ip();
        if ( empty( $client_ip ) ) {
            return;
        }

        if ( in_array( $client_ip, $blocked_ips, true ) ) {
            status_header( 403 );
            header( 'Content-Type: text/plain; charset=utf-8' );
            echo 'Access denied.';
            exit;
        }
    }

    private function get_client_ip() {
        $headers = array( 'HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR' );
        foreach ( $headers as $h ) {
            if ( ! empty( $_SERVER[ $h ] ) ) {
                $ip = trim( explode( ',', $_SERVER[ $h ] )[0] );
                if ( filter_var( $ip, FILTER_VALIDATE_IP ) ) {
                    return $ip;
                }
            }
        }
        return '';
    }
}
