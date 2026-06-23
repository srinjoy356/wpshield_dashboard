<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Handles activation, deactivation, uninstall.
 *
 * Local DB tables are used as a queue + file-hash baseline.
 * The authoritative storage is Supabase.
 */
class WPShield_Installer {

    public static function activate() {
        global $wpdb;

        $charset = $wpdb->get_charset_collate();
        $queue   = $wpdb->prefix . WPSHIELD_QUEUE_TABLE;
        $hashes  = $wpdb->prefix . WPSHIELD_HASH_TABLE;

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $sql_queue = "CREATE TABLE {$queue} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            event_type VARCHAR(50) NOT NULL,
            severity VARCHAR(20) NOT NULL DEFAULT 'low',
            payload LONGTEXT NOT NULL,
            attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            created_at DATETIME NOT NULL,
            sent_at DATETIME NULL,
            PRIMARY KEY (id),
            KEY status_idx (status),
            KEY type_idx (event_type)
        ) {$charset};";

        $sql_hashes = "CREATE TABLE {$hashes} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            file_path VARCHAR(500) NOT NULL,
            file_hash CHAR(64) NOT NULL,
            file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
            last_checked DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY path_idx (file_path(191))
        ) {$charset};";

        dbDelta( $sql_queue );
        dbDelta( $sql_hashes );

        // Seed default settings — only if class is loaded.
        if ( false === get_option( WPSHIELD_OPTION_KEY ) && class_exists( 'WPShield_Settings' ) ) {
            add_option( WPSHIELD_OPTION_KEY, WPShield_Settings::defaults() );
        }

        // Cron is scheduled later by WPShield_Cron::ensure_scheduled() on `init`.
        // Doing it here is fragile because custom schedules aren't registered until plugins_loaded.
    }

    public static function deactivate() {
        wp_clear_scheduled_hook( 'wpshield_flush_queue' );
        wp_clear_scheduled_hook( 'wpshield_periodic_scan' );
        wp_clear_scheduled_hook( 'wpshield_daily_snapshot' );

        // Ping dashboard to mark this site as inactive
        $settings = get_option( WPSHIELD_OPTION_KEY, array() );
        $site_token   = isset( $settings['site_token'] )   ? $settings['site_token']   : '';
        $api_endpoint = isset( $settings['api_endpoint'] ) ? $settings['api_endpoint'] : '';

        if ( $site_token && $api_endpoint ) {
            $endpoint = rtrim( $api_endpoint, '/' ) . '/api/sites/deactivate';
            wp_remote_post( $endpoint, array(
                'body'    => wp_json_encode( array( 'deactivated_at' => gmdate( 'Y-m-d H:i:s' ) ) ),
                'headers' => array(
                    'Content-Type'  => 'application/json',
                    'Authorization' => 'Bearer ' . $site_token,
                ),
                'timeout'  => 8,
                'blocking' => false, // fire and forget — don't delay deactivation
            ) );
        }
    }

    public static function uninstall() {
        global $wpdb;
        $queue  = $wpdb->prefix . WPSHIELD_QUEUE_TABLE;
        $hashes = $wpdb->prefix . WPSHIELD_HASH_TABLE;
        $wpdb->query( "DROP TABLE IF EXISTS {$queue}" );
        $wpdb->query( "DROP TABLE IF EXISTS {$hashes}" );
        delete_option( WPSHIELD_OPTION_KEY );
    }
}
