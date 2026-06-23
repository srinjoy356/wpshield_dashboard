<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Plugin / theme / core health & inventory snapshot.
 *
 * Sends a daily snapshot so the VPS can run vulnerability matching
 * (e.g. against WPScan-style feeds) on the central side.
 */
class WPShield_Collector_Health {

    public function __construct() {
        add_action( 'wpshield_periodic_scan',  array( $this, 'maybe_snapshot' ) );
        add_action( 'wpshield_force_snapshot', array( $this, 'force_snapshot' ) );
    }

    public function maybe_snapshot() {
        // Throttle to once per 24h.
        $last = (int) get_option( 'wpshield_last_health_snapshot', 0 );
        if ( ( time() - $last ) < DAY_IN_SECONDS ) {
            return;
        }
        $this->run_snapshot();
    }

    /**
     * Force an immediate snapshot regardless of the 24h throttle.
     * Called by manual flush and test ping from the admin UI.
     */
    public function force_snapshot() {
        $this->run_snapshot();
    }

    private function run_snapshot() {
        update_option( 'wpshield_last_health_snapshot', time(), false );

        $settings = WPShield_Settings::get();

        if ( ! empty( $settings['checklist']['core_info'] ) ) {
            $this->snapshot_core();
        }
        if ( ! empty( $settings['checklist']['plugin_health'] ) ) {
            $this->snapshot_plugins();
        }
        if ( ! empty( $settings['checklist']['theme_health'] ) ) {
            $this->snapshot_themes();
        }
    }

    private function snapshot_core() {
        global $wp_version;
        WPShield_Logger::log( 'health', 'low', array(
            'kind'        => 'core',
            'wp_version'  => $wp_version,
            'php_version' => PHP_VERSION,
            'is_multisite'=> is_multisite() ? 1 : 0,
            'site_url'    => home_url(),
            'admin_email' => get_option( 'admin_email' ),
        ) );
    }

    private function snapshot_plugins() {
        if ( ! function_exists( 'get_plugins' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        $all     = get_plugins();
        $active  = (array) get_option( 'active_plugins', array() );
        $updates = get_site_transient( 'update_plugins' );
        $pending = isset( $updates->response ) ? $updates->response : array();

        $list = array();
        foreach ( $all as $file => $data ) {
            $list[] = array(
                'slug'           => dirname( $file ) ?: basename( $file, '.php' ),
                'file'           => $file,
                'name'           => isset( $data['Name'] )        ? $data['Name']        : '',
                'version'        => isset( $data['Version'] )     ? $data['Version']     : '',
                'author'         => isset( $data['Author'] )      ? wp_strip_all_tags( $data['Author'] ) : '',
                'is_active'      => in_array( $file, $active, true ) ? 1 : 0,
                'update_pending' => isset( $pending[ $file ] ) ? 1 : 0,
                'new_version'    => isset( $pending[ $file ]->new_version ) ? $pending[ $file ]->new_version : '',
            );
        }

        WPShield_Logger::log( 'health', 'low', array(
            'kind'    => 'plugins',
            'count'   => count( $list ),
            'plugins' => $list,
        ) );
    }

    private function snapshot_themes() {
        $themes  = wp_get_themes();
        $active  = wp_get_theme();
        $updates = get_site_transient( 'update_themes' );
        $pending = isset( $updates->response ) ? $updates->response : array();

        $list = array();
        foreach ( $themes as $stylesheet => $theme ) {
            $list[] = array(
                'slug'           => $stylesheet,
                'name'           => $theme->get( 'Name' ),
                'version'        => $theme->get( 'Version' ),
                'author'         => wp_strip_all_tags( $theme->get( 'Author' ) ),
                'is_active'      => ( $active && $active->get_stylesheet() === $stylesheet ) ? 1 : 0,
                'update_pending' => isset( $pending[ $stylesheet ] ) ? 1 : 0,
                'new_version'    => isset( $pending[ $stylesheet ]['new_version'] ) ? $pending[ $stylesheet ]['new_version'] : '',
            );
        }

        WPShield_Logger::log( 'health', 'low', array(
            'kind'   => 'themes',
            'count'  => count( $list ),
            'themes' => $list,
        ) );
    }
}
