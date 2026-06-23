<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Login activity tracker — successes, failures, lockouts, role escalations.
 */
class WPShield_Collector_Login {

    public function __construct() {
        add_action( 'wp_login',          array( $this, 'on_success' ), 10, 2 );
        add_action( 'wp_login_failed',   array( $this, 'on_failure' ), 10, 1 );
        add_action( 'wp_logout',         array( $this, 'on_logout' ),  10, 1 );
        add_action( 'set_user_role',     array( $this, 'on_role_change' ), 10, 3 );
        add_action( 'user_register',     array( $this, 'on_user_create' ), 10, 1 );
    }

    public function on_success( $user_login, $user ) {
        WPShield_Logger::log( 'login', 'low', array(
            'event'   => 'login_success',
            'user_id' => isset( $user->ID ) ? (int) $user->ID : 0,
            'login'   => $user_login,
            'roles'   => isset( $user->roles ) ? (array) $user->roles : array(),
            'ip'      => WPShield_Logger::client_ip(),
        ) );
    }

    public function on_failure( $user_login ) {
        WPShield_Logger::log( 'login', 'medium', array(
            'event' => 'login_failed',
            'login' => substr( (string) $user_login, 0, 100 ),
            'ip'    => WPShield_Logger::client_ip(),
        ) );
    }

    public function on_logout( $user_id ) {
        WPShield_Logger::log( 'login', 'low', array(
            'event'   => 'logout',
            'user_id' => (int) $user_id,
            'ip'      => WPShield_Logger::client_ip(),
        ) );
    }

    public function on_role_change( $user_id, $new_role, $old_roles ) {
        $severity = ( 'administrator' === $new_role ) ? 'high' : 'medium';
        WPShield_Logger::log( 'login', $severity, array(
            'event'     => 'role_changed',
            'user_id'   => (int) $user_id,
            'new_role'  => $new_role,
            'old_roles' => (array) $old_roles,
            'ip'        => WPShield_Logger::client_ip(),
        ) );
    }

    public function on_user_create( $user_id ) {
        $user = get_userdata( $user_id );
        WPShield_Logger::log( 'login', 'medium', array(
            'event'     => 'user_created',
            'user_id'   => (int) $user_id,
            'login'     => $user ? $user->user_login : '',
            'roles'     => $user ? (array) $user->roles : array(),
            'ip'        => WPShield_Logger::client_ip(),
        ) );
    }
}
