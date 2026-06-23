<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * WPShield Maintenance Mode (Chunk 10)
 *
 * Reads maintenance_mode flag from Supabase via config sync.
 * When enabled, shows a maintenance page to all non-admin visitors.
 * Admins (logged-in users with manage_options) bypass it.
 */
class WPShield_Maintenance_Mode {

    public function __construct() {
        // Hook early — before WordPress renders anything
        add_action( 'template_redirect', array( $this, 'maybe_show_maintenance' ), 1 );
        add_action( 'init',              array( $this, 'maybe_block_frontend' ), 1 );
    }

    public function maybe_block_frontend() {
        // Skip admin, cron
        if ( is_admin() || wp_doing_cron() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
            return;
        }

        // Reliably detect REST requests during 'init' (before REST_REQUEST is defined)
        $rest_prefix = function_exists('rest_get_url_prefix') ? rest_get_url_prefix() : 'wp-json';
        if ( isset( $_SERVER['REQUEST_URI'] ) && false !== strpos( $_SERVER['REQUEST_URI'], '/' . $rest_prefix ) ) {
            return;
        }

        // Skip login page
        if ( isset( $_SERVER['REQUEST_URI'] ) && false !== strpos( $_SERVER['REQUEST_URI'], 'wp-login.php' ) ) {
            return;
        }

        $config = WPShield_Config_Sync::get();
        if ( empty( $config['maintenance_mode'] ) ) {
            return;
        }

        // Allow logged-in admins through
        if ( is_user_logged_in() && current_user_can( 'manage_options' ) ) {
            return;
        }

        $this->show_maintenance_page();
    }

    public function maybe_show_maintenance() {
        // Additional check on template_redirect for theme pages
        $config = WPShield_Config_Sync::get();
        if ( empty( $config['maintenance_mode'] ) ) {
            return;
        }
        if ( is_user_logged_in() && current_user_can( 'manage_options' ) ) {
            return;
        }
        $this->show_maintenance_page();
    }

    private function show_maintenance_page() {
        $site_name = get_bloginfo( 'name' );
        status_header( 503 );
        header( 'Retry-After: 3600' );
        header( 'Content-Type: text/html; charset=utf-8' );
        ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Maintenance – <?php echo esc_html( $site_name ); ?></title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f9fafb;
            display: flex; align-items: center; justify-content: center;
            min-height: 100vh; color: #111827;
        }
        .container {
            text-align: center; max-width: 480px; padding: 40px 24px;
        }
        .icon { font-size: 64px; margin-bottom: 24px; }
        h1 { font-size: 28px; font-weight: 700; margin-bottom: 12px; color: #0a6358; }
        p { font-size: 16px; color: #6b7280; line-height: 1.6; }
        .badge {
            display: inline-block; margin-top: 24px;
            padding: 6px 16px; border-radius: 999px;
            background: #e6f4f1; color: #0a6358;
            font-size: 13px; font-weight: 600;
        }
        .powered {
            margin-top: 40px; font-size: 11px; color: #9ca3af;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🛡️</div>
        <h1>We'll be back soon</h1>
        <p><?php echo esc_html( $site_name ); ?> is currently undergoing scheduled maintenance. We'll be back shortly.</p>
        <span class="badge">Maintenance Mode</span>
        <p class="powered">Secured by Cybernara WPShield</p>
    </div>
</body>
</html>
        <?php
        exit;
    }
}
