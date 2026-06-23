<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Wires up cron schedules and ensures the flush job runs at the
 * interval the admin selected in the settings page.
 */
class WPShield_Cron {

    public function __construct() {
        add_filter( 'cron_schedules',       array( $this, 'register_schedules' ) );
        add_action( 'wpshield_flush_queue', array( 'WPShield_Transmitter', 'flush' ) );
        // Refresh remote config on every flush so away mode, IP blocking,
        // geo blocking and maintenance mode take effect within 2 minutes.
        add_action( 'wpshield_flush_queue', array( 'WPShield_Config_Sync', 'fetch' ) );

        // Make sure schedules are present and match the chosen interval.
        add_action( 'init', array( $this, 'ensure_scheduled' ) );

        // Re-schedule whenever settings are saved (interval may have changed).
        add_action( 'update_option_' . WPSHIELD_OPTION_KEY, array( $this, 'on_settings_change' ), 10, 2 );
    }

    /**
     * Register every supported flush schedule with WP cron.
     */
    public function register_schedules( $schedules ) {
        foreach ( WPShield_Settings::all_intervals() as $key ) {
            $slug = WPShield_Settings::interval_slug( $key );
            $schedules[ $slug ] = array(
                'interval' => WPShield_Settings::interval_seconds( $key ),
                'display'  => WPShield_Settings::interval_label( $key ),
            );
        }
        return $schedules;
    }

    /**
     * Make sure the flush job exists and is on the right schedule.
     */
    public function ensure_scheduled() {
        $settings = WPShield_Settings::get();
        $desired  = WPShield_Settings::interval_slug( $settings['flush_interval'] );

        $next     = wp_next_scheduled( 'wpshield_flush_queue' );
        $current  = wp_get_schedule( 'wpshield_flush_queue' );

        if ( ! $next ) {
            wp_schedule_event( time() + 60, $desired, 'wpshield_flush_queue' );
        } elseif ( $current !== $desired ) {
            // Schedule changed (settings update or upgrade). Reschedule.
            wp_clear_scheduled_hook( 'wpshield_flush_queue' );
            wp_schedule_event( time() + 60, $desired, 'wpshield_flush_queue' );
        }

        if ( ! wp_next_scheduled( 'wpshield_periodic_scan' ) ) {
            wp_schedule_event( time() + 300, 'hourly', 'wpshield_periodic_scan' );
        }
    }

    /**
     * If the flush_interval changed in settings, reschedule immediately.
     */
    public function on_settings_change( $old, $new ) {
        $old_int = isset( $old['flush_interval'] ) ? $old['flush_interval'] : '';
        $new_int = isset( $new['flush_interval'] ) ? $new['flush_interval'] : '';
        if ( $old_int !== $new_int ) {
            wp_clear_scheduled_hook( 'wpshield_flush_queue' );
            $slug = WPShield_Settings::interval_slug( $new_int );
            wp_schedule_event( time() + 60, $slug, 'wpshield_flush_queue' );
        }
    }
}
