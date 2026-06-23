<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * WPShield Away Mode
 *
 * Locks wp-admin during configured hours/days.
 * Schedule is fetched from the dashboard via config sync.
 *
 * PREMIUM ONLY — only activates when config returns is_premium: true.
 * Core plan users have away_mode_schedule = null in their config so
 * this is a no-op for them even if the class is instantiated.
 *
 * Schedule format:
 * {
 *   "enabled": true,
 *   "timezone": "Asia/Kolkata",
 *   "allowed_days": [1,2,3,4,5],
 *   "allowed_start": "09:00",
 *   "allowed_end": "18:00",
 *   "whitelist_ips": ["1.2.3.4"]
 * }
 */
class WPShield_Away_Mode {

    public function __construct() {
        add_action( 'init', array( $this, 'maybe_block_admin' ), 1 );
    }

    public function maybe_block_admin() {
        // Only apply to wp-admin and wp-login
        $is_admin_req = is_admin() || ( isset( $_SERVER['REQUEST_URI'] ) && false !== strpos( $_SERVER['REQUEST_URI'], 'wp-login.php' ) );
        if ( ! $is_admin_req ) {
            return;
        }

        // Always allow cron and REST
        if ( wp_doing_cron() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
            return;
        }

        $config = WPShield_Config_Sync::get();

        // Gate: away mode is a premium feature
        if ( empty( $config['is_premium'] ) ) {
            return;
        }

        $schedule = isset( $config['away_mode_schedule'] ) ? $config['away_mode_schedule'] : null;

        if ( empty( $schedule ) || empty( $schedule['enabled'] ) ) {
            return;
        }

        // Whitelist check — these IPs always bypass away mode
        $client_ip = $this->get_client_ip();
        if ( ! empty( $schedule['whitelist_ips'] ) && in_array( $client_ip, (array) $schedule['whitelist_ips'], true ) ) {
            return;
        }

        // Always let super admins through
        if ( is_user_logged_in() && current_user_can( 'manage_options' ) ) {
            // Still check — even admins are blocked outside hours if they're not whitelisted
            // (This matches the intended design: away mode locks everyone out including admins)
        }

        if ( $this->is_within_allowed_window( $schedule ) ) {
            return; // Within allowed hours — let through
        }

        // Outside allowed window — block
        status_header( 403 );
        header( 'Content-Type: text/html; charset=utf-8' );
        ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Outside Business Hours</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f9fafb;
            display: flex; align-items: center; justify-content: center;
            min-height: 100vh; color: #111827;
        }
        .container { text-align: center; max-width: 400px; padding: 40px 24px; }
        .icon { font-size: 56px; margin-bottom: 20px; }
        h1 { font-size: 24px; font-weight: 700; margin-bottom: 10px; color: #0a6358; }
        p { font-size: 15px; color: #6b7280; line-height: 1.6; }
        .badge {
            display: inline-block; margin-top: 20px;
            padding: 5px 14px; border-radius: 999px;
            background: #e6f4f1; color: #0a6358;
            font-size: 12px; font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🔒</div>
        <h1>Access Restricted</h1>
        <p>WordPress admin access is only available during business hours.</p>
        <span class="badge">Secured by Cybernara WPShield</span>
    </div>
</body>
</html>
        <?php
        exit;
    }

    private function is_within_allowed_window( $schedule ) {
        $tz       = isset( $schedule['timezone'] ) ? $schedule['timezone'] : 'UTC';
        $allowed_days  = isset( $schedule['allowed_days'] )  ? (array) $schedule['allowed_days']  : array( 1, 2, 3, 4, 5 );
        $allowed_start = isset( $schedule['allowed_start'] ) ? $schedule['allowed_start'] : '09:00';
        $allowed_end   = isset( $schedule['allowed_end'] )   ? $schedule['allowed_end']   : '18:00';

        try {
            $now_dt    = new DateTime( 'now', new DateTimeZone( $tz ) );
        } catch ( Exception $e ) {
            $now_dt = new DateTime( 'now', new DateTimeZone( 'UTC' ) );
        }

        $day_of_week = (int) $now_dt->format( 'w' ); // 0=Sun, 6=Sat
        if ( ! in_array( $day_of_week, $allowed_days, false ) ) {
            return false;
        }

        $current_time = $now_dt->format( 'H:i' );
        return ( $current_time >= $allowed_start && $current_time < $allowed_end );
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
