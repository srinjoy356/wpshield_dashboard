<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * WPShield Receiver
 *
 * Listens for incoming POST requests from the Cybernara Dashboard
 * for instant one-click remediation actions (e.g. deleting malware).
 */
class WPShield_Receiver {

    public function __construct() {
        add_action( 'rest_api_init', array( $this, 'register_routes' ) );
    }

    public function register_routes() {
        register_rest_route( 'wpshield/v1', '/remediate', array(
            'methods'             => 'POST',
            'callback'            => array( $this, 'handle_remediation_request' ),
            'permission_callback' => array( $this, 'verify_bearer_token' ),
        ) );

        register_rest_route( 'wpshield/v1', '/purge-config-cache', array(
            'methods'             => 'POST',
            'callback'            => array( $this, 'handle_purge_config_cache' ),
            'permission_callback' => array( $this, 'verify_bearer_token' ),
        ) );
    }

    /**
     * Immediately purges the local config cache so the next request
     * to WPShield_Config_Sync::get() fetches a fresh copy from the dashboard.
     * Called by the dashboard right after Coraza auto-bans an IP.
     */
    public function handle_purge_config_cache( WP_REST_Request $request ) {
        delete_transient( 'wpshield_remote_config' );
        // Pre-warm the cache immediately so the next real visitor
        // doesn't pay the cost of a synchronous fetch.
        WPShield_Config_Sync::fetch();
        return rest_ensure_response( array(
            'success' => true,
            'message' => 'Config cache purged and refreshed.',
        ) );
    }

    /**
     * Verify the Bearer token matches the hashed site_token saved in settings.
     */
    public function verify_bearer_token( WP_REST_Request $request ) {
        $header = $request->get_header( 'authorization' );
        if ( ! $header ) {
            return new WP_Error( 'missing_token', 'Authorization header is missing.', array( 'status' => 401 ) );
        }

        // Expected format: "Bearer <token>"
        $token = str_replace( 'Bearer ', '', $header );
        $token = trim( $token );

        $settings = get_option( 'wpshield_settings', array() );
        $site_token = isset( $settings['site_token'] ) ? $settings['site_token'] : '';

        if ( empty( $site_token ) ) {
            return new WP_Error( 'invalid_token', 'Invalid site token.', array( 'status' => 403 ) );
        }

        $expected_hash = hash('sha256', $site_token);

        if ( ! hash_equals( $expected_hash, $token ) ) {
            return new WP_Error( 'invalid_token', 'Invalid site token.', array( 'status' => 403 ) );
        }

        return true;
    }

    /**
     * Create a backup of a file before modifying/deleting it.
     */
    private function backup_file( $file_path ) {
        if ( ! file_exists( $file_path ) ) {
            return false;
        }

        $upload_dir = wp_upload_dir();
        $backup_dir = trailingslashit( $upload_dir['basedir'] ) . 'wpshield-backups';

        // Create backup dir if it doesn't exist
        if ( ! file_exists( $backup_dir ) ) {
            wp_mkdir_p( $backup_dir );
            
            // Protect backup directory
            $htaccess = $backup_dir . '/.htaccess';
            if ( ! file_exists( $htaccess ) ) {
                file_put_contents( $htaccess, "Deny from all\nOptions -Indexes" );
            }
            $index = $backup_dir . '/index.php';
            if ( ! file_exists( $index ) ) {
                file_put_contents( $index, "<?php\n// Silence is golden." );
            }
        }

        // Generate unique backup filename
        $basename = basename( $file_path );
        $timestamp = current_time( 'timestamp' );
        $backup_file = $backup_dir . '/' . $basename . '.' . $timestamp . '.bak';

        return copy( $file_path, $backup_file );
    }

    /**
     * Handle the requested action.
     */
    public function handle_remediation_request( WP_REST_Request $request ) {
        $params = $request->get_json_params();
        if ( empty( $params['action'] ) ) {
            return new WP_Error( 'missing_action', 'Action is required.', array( 'status' => 400 ) );
        }

        $action = sanitize_text_field( $params['action'] );

        switch ( $action ) {
            case 'delete_file':
                if ( empty( $params['file_path'] ) ) {
                    return new WP_Error( 'missing_path', 'File path is required.', array( 'status' => 400 ) );
                }
                
                // Sanitize path (avoid traversal)
                $file_path = sanitize_text_field( $params['file_path'] );
                if ( strpos( $file_path, '..' ) !== false ) {
                    return new WP_Error( 'invalid_path', 'Invalid file path.', array( 'status' => 400 ) );
                }

                // Convert to absolute path assuming it was given relative to ABSPATH
                $absolute_path = wp_normalize_path( ABSPATH . ltrim( $file_path, '/' ) );
                
                // Verify the file exists and is within ABSPATH
                if ( ! file_exists( $absolute_path ) || strpos( $absolute_path, wp_normalize_path( ABSPATH ) ) !== 0 ) {
                    return new WP_Error( 'file_not_found', 'File not found or outside allowed directory.', array( 'status' => 404 ) );
                }

                // Prevent deleting core WP files directly here (safety check)
                $basename = basename( $absolute_path );
                if ( in_array( $basename, array( 'wp-config.php', 'index.php', '.htaccess' ) ) ) {
                    return new WP_Error( 'protected_file', 'Cannot delete protected core files.', array( 'status' => 403 ) );
                }

                // Take backup
                $backed_up = $this->backup_file( $absolute_path );
                if ( ! $backed_up ) {
                    return new WP_Error( 'backup_failed', 'Failed to create backup before deletion.', array( 'status' => 500 ) );
                }

                // Delete file
                if ( unlink( $absolute_path ) ) {
                    return rest_ensure_response( array(
                        'success' => true,
                        'message' => 'File deleted successfully. Backup created.',
                        'action'  => 'delete_file',
                    ) );
                } else {
                    return new WP_Error( 'delete_failed', 'Failed to delete file (permission denied).', array( 'status' => 500 ) );
                }

            case 'quarantine_file':
                // Similar to delete but moves it
                if ( empty( $params['file_path'] ) ) {
                    return new WP_Error( 'missing_path', 'File path is required.', array( 'status' => 400 ) );
                }
                
                $file_path = sanitize_text_field( $params['file_path'] );
                if ( strpos( $file_path, '..' ) !== false ) {
                    return new WP_Error( 'invalid_path', 'Invalid file path.', array( 'status' => 400 ) );
                }

                $absolute_path = wp_normalize_path( ABSPATH . ltrim( $file_path, '/' ) );
                if ( ! file_exists( $absolute_path ) || strpos( $absolute_path, wp_normalize_path( ABSPATH ) ) !== 0 ) {
                    return new WP_Error( 'file_not_found', 'File not found.', array( 'status' => 404 ) );
                }

                $basename = basename( $absolute_path );
                if ( in_array( $basename, array( 'wp-config.php', 'index.php', '.htaccess' ) ) ) {
                    return new WP_Error( 'protected_file', 'Cannot quarantine protected core files.', array( 'status' => 403 ) );
                }

                // Take backup
                $backed_up = $this->backup_file( $absolute_path );
                
                // Then rename/quarantine in place by appending .quarantined
                $quarantined_path = $absolute_path . '.quarantined';
                if ( rename( $absolute_path, $quarantined_path ) ) {
                    return rest_ensure_response( array(
                        'success' => true,
                        'message' => 'File quarantined successfully.',
                        'action'  => 'quarantine_file',
                    ) );
                } else {
                    return new WP_Error( 'quarantine_failed', 'Failed to quarantine file.', array( 'status' => 500 ) );
                }
            case 'update_plugin':
                if ( empty( $params['plugin_slug'] ) ) {
                    return new WP_Error( 'missing_slug', 'Plugin slug is required.', array( 'status' => 400 ) );
                }

                $plugin_slug = sanitize_text_field( $params['plugin_slug'] );

                if ( ! function_exists( 'request_filesystem_credentials' ) ) {
                    require_once ABSPATH . 'wp-admin/includes/file.php';
                }
                
                include_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
                
                if ( defined( 'DISALLOW_FILE_MODS' ) && DISALLOW_FILE_MODS ) {
                    return new WP_Error( 'file_mods_disallowed', 'File modifications are disabled on this site.', array( 'status' => 403 ) );
                }

                $upgrader = new Plugin_Upgrader( new Automatic_Upgrader_Skin() );
                $result = $upgrader->upgrade( $plugin_slug );

                if ( is_wp_error( $result ) ) {
                    return new WP_Error( 'update_failed', $result->get_error_message(), array( 'status' => 500 ) );
                }

                if ( $result === false ) {
                    return new WP_Error( 'update_failed', 'Plugin update failed.', array( 'status' => 500 ) );
                }

                return rest_ensure_response( array(
                    'success' => true,
                    'message' => 'Plugin updated successfully.',
                    'action'  => 'update_plugin',
                ) );

            default:
                return new WP_Error( 'invalid_action', 'Unknown action.', array( 'status' => 400 ) );
        }
    }
}
