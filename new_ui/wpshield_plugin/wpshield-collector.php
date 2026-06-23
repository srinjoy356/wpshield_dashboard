<?php
/**
 * Plugin Name: WPShield Collector
 * Plugin URI:  https://cybernara.com
 * Description: Security telemetry collector for WordPress. Streams events to WPShield Dashboard. Supports maintenance mode, away mode, geo blocking, active IP blocking, user activity log, and malware scanning.
 * Version:     3.3.0
 * Author:      Cybernara WPShield
 * License:     GPLv2 or later
 * Text Domain: wpshield-collector
 * Requires at least: 5.6
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
define( 'WPSHIELD_VERSION',     '3.3.0' );
define( 'WPSHIELD_FILE',        __FILE__ );
define( 'WPSHIELD_DIR',         plugin_dir_path( __FILE__ ) );
define( 'WPSHIELD_URL',         plugin_dir_url( __FILE__ ) );
define( 'WPSHIELD_OPTION_KEY',  'wpshield_settings' );
define( 'WPSHIELD_QUEUE_TABLE', 'wpshield_queue' );
define( 'WPSHIELD_HASH_TABLE',  'wpshield_file_hashes' );

// ---------------------------------------------------------------------------
// Includes
// ---------------------------------------------------------------------------
require_once WPSHIELD_DIR . 'includes/class-wpshield-settings.php';
require_once WPSHIELD_DIR . 'includes/class-wpshield-installer.php';
require_once WPSHIELD_DIR . 'includes/class-wpshield-logger.php';
require_once WPSHIELD_DIR . 'includes/class-wpshield-transmitter.php';
require_once WPSHIELD_DIR . 'includes/class-wpshield-config-sync.php';
require_once WPSHIELD_DIR . 'includes/class-wpshield-collector-attack.php';
require_once WPSHIELD_DIR . 'includes/class-wpshield-collector-login.php';
require_once WPSHIELD_DIR . 'includes/class-wpshield-collector-files.php';
require_once WPSHIELD_DIR . 'includes/class-wpshield-collector-health.php';
require_once WPSHIELD_DIR . 'includes/class-wpshield-collector-activity.php';
require_once WPSHIELD_DIR . 'includes/class-wpshield-malware-scanner.php';
require_once WPSHIELD_DIR . 'includes/class-wpshield-maintenance-mode.php';
require_once WPSHIELD_DIR . 'includes/class-wpshield-away-mode.php';
require_once WPSHIELD_DIR . 'includes/class-wpshield-footer-attribution.php';
require_once WPSHIELD_DIR . 'includes/class-wpshield-active-blocker.php';
require_once WPSHIELD_DIR . 'includes/class-wpshield-geo-blocker.php';
require_once WPSHIELD_DIR . 'includes/class-wpshield-cron.php';
require_once WPSHIELD_DIR . 'includes/class-wpshield-updater.php';
require_once WPSHIELD_DIR . 'includes/class-wpshield-receiver.php';
require_once WPSHIELD_DIR . 'admin/class-wpshield-admin.php';

// ---------------------------------------------------------------------------
// Activation / Deactivation
// ---------------------------------------------------------------------------
register_activation_hook(   __FILE__, array( 'WPShield_Installer', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'WPShield_Installer', 'deactivate' ) );
register_uninstall_hook(    __FILE__, array( 'WPShield_Installer', 'uninstall' ) );

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
add_action( 'plugins_loaded', 'wpshield_boot' );

function wpshield_boot() {

    // Always-on: admin UI, cron scheduler, auto-updater.
    new WPShield_Admin();
    new WPShield_Cron();
    new WPShield_Updater( 'cybernara-wpshield', WPSHIELD_VERSION );

    // Config sync always initialises — pulls remote config via cron.
    // Works for both free (Core) and paid plans once the plugin is connected.
    WPShield_Config_Sync::init();

    $settings = WPShield_Settings::get();

    // Gate: plugin must be enabled AND connected (has site_token + company_id).
    // This is true for both free-tier users (connected via Free Connect) and
    // paid users (connected via license key). No license is required here —
    // the dashboard controls which features are active via the config sync
    // response (is_premium flag).
    if ( empty( $settings['enabled'] ) ||
         empty( $settings['company_id'] ) ||
         empty( $settings['site_token'] ) ) {
        return;
    }

    // ── Features active for ALL connected plans (Core and above) ────────────

    // Receiver: handles force-sync and other push commands from dashboard
    new WPShield_Receiver();

    // Maintenance mode — reads from config sync (available on Core plan)
    new WPShield_Maintenance_Mode();

    // Footer attribution badge
    new WPShield_Footer_Attribution();

    // ── Premium-only features — each class checks is_premium internally ─────
    // Away mode — locks wp-admin outside business hours (Solo+)
    new WPShield_Away_Mode();

    // Active IP blocking — blocks flagged IPs (Solo+)
    new WPShield_Active_Blocker();

    // Geo IP blocking — blocks requests from blocked countries (Solo+)
    new WPShield_Geo_Blocker();

    // ── Data collectors — checklist-controlled ───────────────────────────────
    // All available on Core plan (data is collected regardless of premium status;
    // the dashboard limits *display* to 7 days for Core users).
    $checklist = isset( $settings['checklist'] ) ? (array) $settings['checklist'] : array();

    if ( ! empty( $checklist['attack_detection'] ) ) {
        new WPShield_Collector_Attack();
    }
    if ( ! empty( $checklist['login_activity'] ) ) {
        new WPShield_Collector_Login();
    }
    if ( ! empty( $checklist['file_integrity'] ) ) {
        new WPShield_Collector_Files();
    }
    if ( ! empty( $checklist['plugin_health'] ) || ! empty( $checklist['theme_health'] ) || ! empty( $checklist['core_info'] ) ) {
        new WPShield_Collector_Health();
    }
    if ( ! empty( $checklist['user_activity'] ) ) {
        new WPShield_Collector_Activity();
    }
    if ( ! empty( $checklist['malware_scan'] ) ) {
        new WPShield_Malware_Scanner();
    }

    // Refresh remote config on every queue flush
    add_action( 'wpshield_flush_queue', array( 'WPShield_Config_Sync', 'fetch' ) );
}
