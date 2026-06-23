<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * WPShield User Activity Log (Chunk 11)
 *
 * Tracks significant admin actions inside wp-admin:
 * - Plugin install / activate / deactivate / delete
 * - Theme switch
 * - Settings changes (general, permalink, etc.)
 * - Post/page publish, update, delete
 * - User create / delete / password change
 * - WordPress core update
 *
 * Logs to wpshield_events_activity table via queue.
 * Uses event_type = 'activity' (new type alongside existing ones).
 */
class WPShield_Collector_Activity {

    public function __construct() {
        // Plugin actions
        add_action( 'activated_plugin',   array( $this, 'on_plugin_activate' ),   10, 1 );
        add_action( 'deactivated_plugin', array( $this, 'on_plugin_deactivate' ), 10, 1 );
        add_action( 'delete_plugin',      array( $this, 'on_plugin_delete' ),     10, 1 );
        add_action( 'upgrader_process_complete', array( $this, 'on_plugin_install' ), 10, 2 );

        // Theme actions
        add_action( 'switch_theme', array( $this, 'on_theme_switch' ), 10, 2 );

        // Settings changes
        add_action( 'update_option', array( $this, 'on_option_update' ), 10, 3 );

        // Post actions
        add_action( 'transition_post_status', array( $this, 'on_post_status_change' ), 10, 3 );
        add_action( 'delete_post',            array( $this, 'on_post_delete' ),         10, 1 );

        // User actions
        add_action( 'delete_user',            array( $this, 'on_user_delete' ),      10, 1 );
        add_action( 'profile_update',         array( $this, 'on_profile_update' ),   10, 2 );
        add_action( 'password_reset',         array( $this, 'on_password_reset' ),   10, 2 );

        // WordPress updates
        add_action( '_core_updated_successfully', array( $this, 'on_core_update' ), 10, 1 );
    }

    public function on_plugin_activate( $plugin ) {
        $this->log( 'plugin_activated', 'medium', array(
            'plugin' => $plugin,
            'action' => 'Plugin activated',
        ) );
    }

    public function on_plugin_deactivate( $plugin ) {
        $this->log( 'plugin_deactivated', 'low', array(
            'plugin' => $plugin,
            'action' => 'Plugin deactivated',
        ) );
    }

    public function on_plugin_delete( $plugin ) {
        $this->log( 'plugin_deleted', 'high', array(
            'plugin' => $plugin,
            'action' => 'Plugin deleted',
        ) );
    }

    public function on_plugin_install( $upgrader, $options ) {
        if ( isset( $options['action'] ) && $options['action'] === 'install' && isset( $options['type'] ) && $options['type'] === 'plugin' ) {
            $this->log( 'plugin_installed', 'medium', array(
                'action' => 'New plugin installed',
            ) );
        }
    }

    public function on_theme_switch( $new_name, $new_theme ) {
        $this->log( 'theme_switched', 'medium', array(
            'theme'  => $new_name,
            'action' => 'Theme switched to ' . $new_name,
        ) );
    }

    public function on_option_update( $option_name, $old_value, $new_value ) {
        // Only log significant WordPress settings
        $watched = array( 'siteurl', 'blogname', 'blogdescription', 'admin_email', 'default_role', 'permalink_structure', 'blogpublic' );
        if ( ! in_array( $option_name, $watched, true ) ) {
            return;
        }
        $this->log( 'setting_changed', 'medium', array(
            'option' => $option_name,
            'action' => 'WordPress setting changed: ' . $option_name,
        ) );
    }

    public function on_post_status_change( $new_status, $old_status, $post ) {
        if ( ! in_array( $post->post_type, array( 'post', 'page' ), true ) ) {
            return;
        }
        if ( $new_status === $old_status ) {
            return;
        }
        if ( $new_status === 'publish' && $old_status !== 'publish' ) {
            $this->log( 'post_published', 'low', array(
                'post_id'   => $post->ID,
                'post_type' => $post->post_type,
                'title'     => get_the_title( $post ),
                'action'    => $post->post_type . ' published: ' . get_the_title( $post ),
            ) );
        }
    }

    public function on_post_delete( $post_id ) {
        $post = get_post( $post_id );
        if ( ! $post || ! in_array( $post->post_type, array( 'post', 'page' ), true ) ) {
            return;
        }
        $this->log( 'post_deleted', 'medium', array(
            'post_id'   => $post_id,
            'post_type' => $post->post_type,
            'title'     => $post->post_title,
            'action'    => $post->post_type . ' deleted: ' . $post->post_title,
        ) );
    }

    public function on_user_delete( $user_id ) {
        $user = get_userdata( $user_id );
        $this->log( 'user_deleted', 'high', array(
            'user_id' => $user_id,
            'login'   => $user ? $user->user_login : 'unknown',
            'action'  => 'User account deleted: ' . ( $user ? $user->user_login : $user_id ),
        ) );
    }

    public function on_profile_update( $user_id, $old_data ) {
        $user = get_userdata( $user_id );
        $this->log( 'profile_updated', 'low', array(
            'user_id' => $user_id,
            'login'   => $user ? $user->user_login : 'unknown',
            'action'  => 'User profile updated: ' . ( $user ? $user->user_login : $user_id ),
        ) );
    }

    public function on_password_reset( $user, $new_pass ) {
        $this->log( 'password_reset', 'high', array(
            'user_id' => $user->ID,
            'login'   => $user->user_login,
            'action'  => 'Password reset for user: ' . $user->user_login,
        ) );
    }

    public function on_core_update( $wp_version ) {
        $this->log( 'core_updated', 'medium', array(
            'version' => $wp_version,
            'action'  => 'WordPress core updated to ' . $wp_version,
        ) );
    }

    /**
     * Log an activity event.
     * Uses 'activity' event_type which maps to wpshield_events_activity table.
     */
    private function log( $action_type, $severity, array $data ) {
        $current_user = wp_get_current_user();
        WPShield_Logger::log( 'activity', $severity, array_merge( $data, array(
            'action_type' => $action_type,
            'user_id'     => $current_user ? $current_user->ID : 0,
            'user_login'  => $current_user ? $current_user->user_login : 'system',
            'ip'          => WPShield_Logger::client_ip(),
        ) ) );
    }
}
