<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class WPShield_Admin {

    public function __construct() {
        add_action( 'admin_menu',  array( $this, 'menu' ) );
        add_action( 'admin_init',  array( $this, 'handle_form' ) );
        add_action( 'admin_post_wpshield_test_ping',    array( $this, 'handle_test_ping' ) );
        add_action( 'admin_post_wpshield_flush_now',    array( $this, 'handle_flush_now' ) );
        add_action( 'admin_post_wpshield_free_connect', array( $this, 'handle_free_connect' ) );
    }

    public function menu() {
        add_menu_page(
            __( 'WPShield', 'wpshield-collector' ),
            __( 'WPShield', 'wpshield-collector' ),
            'manage_options',
            'wpshield',
            array( $this, 'render_page' ),
            'dashicons-shield-alt',
            76
        );
    }

    // ── Free connect (Core plan — no license key required) ─────────────────
    public function handle_free_connect() {
        if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Forbidden' ); }
        check_admin_referer( 'wpshield_free_connect' );

        $settings = WPShield_Settings::get();
        $api_endpoint = isset( $_POST['wpshield_api_endpoint'] ) ? esc_url_raw( trim( $_POST['wpshield_api_endpoint'] ) ) : $settings['api_endpoint'];
        $company_id   = isset( $_POST['wpshield_company_id'] )   ? sanitize_text_field( trim( $_POST['wpshield_company_id'] ) )  : '';

        if ( empty( $api_endpoint ) || empty( $company_id ) ) {
            wp_safe_redirect( admin_url( 'admin.php?page=wpshield&free_error=missing_fields' ) );
            exit;
        }

        $endpoint = rtrim( $api_endpoint, '/' ) . '/api/license/activate-free';
        $response = wp_remote_post( $endpoint, array(
            'body'    => wp_json_encode( array(
                'site_url'   => get_site_url(),
                'company_id' => $company_id,
            ) ),
            'headers' => array( 'Content-Type' => 'application/json' ),
            'timeout' => 15,
        ) );

        if ( is_wp_error( $response ) ) {
            wp_safe_redirect( admin_url( 'admin.php?page=wpshield&free_error=connection' ) );
            exit;
        }

        $body = json_decode( wp_remote_retrieve_body( $response ), true );
        if ( ! empty( $body['success'] ) && ! empty( $body['site_token'] ) ) {
            $new_settings                  = $settings;
            $new_settings['api_endpoint']  = $api_endpoint;
            $new_settings['company_id']    = $body['company_id'];
            $new_settings['site_token']    = $body['site_token'];
            $new_settings['enabled']       = 1;
            $new_settings['license_key']   = ''; // Core plan — no license
            WPShield_Settings::update( $new_settings );
            wp_safe_redirect( admin_url( 'admin.php?page=wpshield&free_connected=1' ) );
        } else {
            $err = isset( $body['error'] ) ? urlencode( $body['error'] ) : 'unknown';
            wp_safe_redirect( admin_url( 'admin.php?page=wpshield&free_error=' . $err ) );
        }
        exit;
    }

    // ── Save settings + premium license activation ──────────────────────────
    public function handle_form() {
        if ( ! isset( $_POST['wpshield_save'] ) ) { return; }
        if ( ! current_user_can( 'manage_options' ) ) { return; }
        check_admin_referer( 'wpshield_save_settings' );

        $input        = isset( $_POST['wpshield'] ) ? wp_unslash( $_POST['wpshield'] ) : array();
        $old_settings = WPShield_Settings::get();

        // If a license key was entered or changed, activate it
        if ( ! empty( $input['license_key'] ) && $input['license_key'] !== $old_settings['license_key'] ) {
            $endpoint = rtrim( $input['api_endpoint'], '/' ) . '/api/license/activate';
            $response = wp_remote_post( $endpoint, array(
                'body'    => wp_json_encode( array(
                    'license_key' => $input['license_key'],
                    'site_url'    => get_site_url(),
                ) ),
                'headers' => array( 'Content-Type' => 'application/json' ),
                'timeout' => 15,
            ) );

            if ( ! is_wp_error( $response ) ) {
                $body = json_decode( wp_remote_retrieve_body( $response ), true );
                if ( ! empty( $body['success'] ) && ! empty( $body['site_token'] ) ) {
                    $input['site_token'] = $body['site_token'];
                    $input['company_id'] = $body['company_id'];
                    add_settings_error( 'wpshield', 'activated', __( 'License activated successfully. Premium features are now active.', 'wpshield-collector' ), 'updated' );
                } else {
                    $msg = isset( $body['error'] ) ? $body['error'] : __( 'Unknown error', 'wpshield-collector' );
                    add_settings_error( 'wpshield', 'activation_failed', __( 'License activation failed: ', 'wpshield-collector' ) . $msg, 'error' );
                    $input['site_token'] = $old_settings['site_token']; // keep existing token
                }
            } else {
                add_settings_error( 'wpshield', 'activation_error', __( 'Connection error during activation.', 'wpshield-collector' ), 'error' );
            }
        }

        $saved = WPShield_Settings::update( $input );

        // Push footer_attribution preference to dashboard
        if ( ! empty( $saved['site_token'] ) && ! empty( $saved['company_id'] ) && ! empty( $saved['api_endpoint'] ) ) {
            $fa_endpoint = rtrim( $saved['api_endpoint'], '/' ) . '/api/settings/attribution';
            wp_remote_post( $fa_endpoint, array(
                'body'    => wp_json_encode( array(
                    'company_id'         => $saved['company_id'],
                    'footer_attribution' => (bool) $saved['footer_attribution'],
                ) ),
                'headers' => array(
                    'Content-Type'  => 'application/json',
                    'Authorization' => 'Bearer ' . $saved['site_token'],
                ),
                'timeout' => 8,
            ) );
        }

        if ( empty( get_settings_errors( 'wpshield' ) ) ) {
            add_settings_error( 'wpshield', 'saved', __( 'Settings saved.', 'wpshield-collector' ), 'updated' );
        }
    }

    public function handle_test_ping() {
        if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'forbidden' ); }
        check_admin_referer( 'wpshield_test_ping' );

        global $wpdb;
        $settings = WPShield_Settings::get();
        $payload  = array(
            'company_id'  => $settings['company_id'],
            'site_url'    => home_url(),
            'event_type'  => 'health',
            'severity'    => 'low',
            'occurred_at' => gmdate( 'Y-m-d H:i:s' ),
            'data'        => array( 'kind' => 'test_ping', 'message' => 'Manual test ping from admin UI' ),
        );
        $wpdb->insert(
            $wpdb->prefix . WPSHIELD_QUEUE_TABLE,
            array(
                'event_type' => 'health',
                'severity'   => 'low',
                'payload'    => wp_json_encode( $payload ),
                'status'     => 'pending',
                'created_at' => current_time( 'mysql', true ),
            ),
            array( '%s', '%s', '%s', '%s', '%s' )
        );
        WPShield_Transmitter::flush();
        do_action( 'wpshield_force_snapshot' );
        WPShield_Transmitter::flush();
        delete_transient( 'wpshield_remote_config' );
        wp_safe_redirect( admin_url( 'admin.php?page=wpshield&pinged=1' ) );
        exit;
    }

    public function handle_flush_now() {
        if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'forbidden' ); }
        check_admin_referer( 'wpshield_flush_now' );

        $settings = WPShield_Settings::get();
        if ( empty( $settings['site_token'] ) || empty( $settings['company_id'] ) ) {
            wp_safe_redirect( admin_url( 'admin.php?page=wpshield&flush_error=not_configured' ) );
            exit;
        }
        do_action( 'wpshield_force_snapshot' );
        do_action( 'wpshield_periodic_scan' );
        WPShield_Transmitter::flush();
        delete_transient( 'wpshield_remote_config' );
        wp_safe_redirect( admin_url( 'admin.php?page=wpshield&flushed=1' ) );
        exit;
    }

    public function render_page() {
        if ( ! current_user_can( 'manage_options' ) ) { return; }

        $s = WPShield_Settings::get();
        global $wpdb;
        $table   = $wpdb->prefix . WPSHIELD_QUEUE_TABLE;
        $pending = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE status='pending'" );
        $sent    = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE status='sent'" );
        $failed  = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE status='failed'" );

        $is_connected = ! empty( $s['site_token'] ) && ! empty( $s['company_id'] );
        $has_license  = ! empty( $s['license_key'] );

        // Determine plan tier from config sync
        $config   = WPShield_Config_Sync::get();
        $is_premium = ! empty( $config['is_premium'] );
        ?>
        <div class="wrap">
            <h1><?php esc_html_e( 'WPShield Security', 'wpshield-collector' ); ?></h1>
            <p><?php esc_html_e( 'Telemetry collector and active protection module.', 'wpshield-collector' ); ?></p>

            <?php settings_errors( 'wpshield' ); ?>

            <?php if ( isset( $_GET['pinged'] ) ) : ?>
                <div class="notice notice-success"><p><?php esc_html_e( 'Test ping queued and flush attempted.', 'wpshield-collector' ); ?></p></div>
            <?php endif; ?>
            <?php if ( isset( $_GET['flushed'] ) ) : ?>
                <div class="notice notice-success"><p><?php esc_html_e( 'Manual flush executed.', 'wpshield-collector' ); ?></p></div>
            <?php endif; ?>
            <?php if ( isset( $_GET['free_connected'] ) ) : ?>
                <div class="notice notice-success"><p><?php esc_html_e( 'Connected successfully! WPShield Core is now active and collecting data.', 'wpshield-collector' ); ?></p></div>
            <?php endif; ?>
            <?php if ( isset( $_GET['free_error'] ) ) : ?>
                <div class="notice notice-error"><p>
                    <?php esc_html_e( 'Free connection failed: ', 'wpshield-collector' ); ?>
                    <?php echo esc_html( urldecode( $_GET['free_error'] ) ); ?>
                </p></div>
            <?php endif; ?>
            <?php if ( isset( $_GET['flush_error'] ) && $_GET['flush_error'] === 'not_configured' ) : ?>
                <div class="notice notice-error"><p><?php esc_html_e( 'Flush failed: plugin is not connected. Please connect below.', 'wpshield-collector' ); ?></p></div>
            <?php endif; ?>

            <?php if ( $is_connected ) : ?>
                <!-- Status banner -->
                <div style="background:#e6f4f1;border:1px solid #0a6358;border-radius:6px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:12px;">
                    <span style="font-size:20px;">✅</span>
                    <div>
                        <strong style="color:#0a6358;">
                            <?php echo $is_premium
                                ? esc_html__( 'WPShield Premium — Active', 'wpshield-collector' )
                                : esc_html__( 'WPShield Core — Active', 'wpshield-collector' ); ?>
                        </strong><br>
                        <span style="font-size:13px;color:#374151;">
                            <?php esc_html_e( 'Company ID:', 'wpshield-collector' ); ?> <code><?php echo esc_html( $s['company_id'] ); ?></code>
                            <?php if ( $is_premium ) : ?>
                                &nbsp;·&nbsp; <?php esc_html_e( 'Premium features active (away mode, IP blocking, geo blocking)', 'wpshield-collector' ); ?>
                            <?php else : ?>
                                &nbsp;·&nbsp; <?php esc_html_e( 'Upgrade to Solo plan for premium features', 'wpshield-collector' ); ?>
                            <?php endif; ?>
                        </span>
                    </div>
                </div>
            <?php else : ?>
                <!-- Not connected — show both connection options -->
                <div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:6px;padding:16px;margin-bottom:20px;">
                    <strong><?php esc_html_e( 'WPShield is not connected.', 'wpshield-collector' ); ?></strong>
                    <p style="margin-top:6px;color:#374151;">
                        <?php esc_html_e( 'Connect for free to start collecting security data. Or enter a license key if you have a paid plan.', 'wpshield-collector' ); ?>
                    </p>
                </div>

                <!-- Free Connect -->
                <div style="border:1px solid #d1fae5;border-radius:8px;padding:20px;margin-bottom:16px;background:#f0fdf4;">
                    <h3 style="margin-top:0;color:#065f46;"><?php esc_html_e( 'Connect Free (Core Plan)', 'wpshield-collector' ); ?></h3>
                    <p style="color:#374151;margin-bottom:16px;">
                        <?php esc_html_e( 'No license key needed. Get attack detection, login logs, file integrity monitoring, and maintenance mode for free.', 'wpshield-collector' ); ?>
                    </p>
                    <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
                        <?php wp_nonce_field( 'wpshield_free_connect' ); ?>
                        <input type="hidden" name="action" value="wpshield_free_connect" />
                        <table class="form-table" role="presentation" style="margin-bottom:0;">
                            <tr>
                                <th scope="row"><label for="wpshield_free_endpoint"><?php esc_html_e( 'Dashboard URL', 'wpshield-collector' ); ?></label></th>
                                <td>
                                    <input id="wpshield_free_endpoint" name="wpshield_api_endpoint" type="url"
                                           value="<?php echo esc_attr( $s['api_endpoint'] ?: 'https://wpshield-dashboard.onrender.com' ); ?>"
                                           class="regular-text" required />
                                </td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="wpshield_free_company"><?php esc_html_e( 'Your Company ID', 'wpshield-collector' ); ?></label></th>
                                <td>
                                    <input id="wpshield_free_company" name="wpshield_company_id" type="text"
                                           value="<?php echo esc_attr( $s['company_id'] ); ?>"
                                           class="regular-text" placeholder="e.g. mediagully" required />
                                    <p class="description"><?php esc_html_e( 'Find this in WPShield Dashboard → Settings → Company ID.', 'wpshield-collector' ); ?></p>
                                </td>
                            </tr>
                        </table>
                        <?php submit_button( __( 'Connect Free', 'wpshield-collector' ), 'primary', 'submit', true ); ?>
                    </form>
                </div>

                <p style="text-align:center;color:#6b7280;margin:8px 0;">— <?php esc_html_e( 'or', 'wpshield-collector' ); ?> —</p>
            <?php endif; ?>

            <!-- Settings form (visible always when connected, or for license entry when not) -->
            <form method="post">
                <?php wp_nonce_field( 'wpshield_save_settings' ); ?>

                <h2 class="title"><?php $is_connected ? esc_html_e( 'Settings', 'wpshield-collector' ) : esc_html_e( 'Activate Premium License', 'wpshield-collector' ); ?></h2>

                <table class="form-table" role="presentation">
                    <?php if ( $is_connected ) : ?>
                    <tr>
                        <th scope="row"><label><?php esc_html_e( 'Enable Protection', 'wpshield-collector' ); ?></label></th>
                        <td>
                            <label>
                                <input type="checkbox" name="wpshield[enabled]" value="1" <?php checked( $s['enabled'], 1 ); ?> />
                                <?php esc_html_e( 'Active — collect telemetry and enforce protection', 'wpshield-collector' ); ?>
                            </label>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="wpshield_api_endpoint"><?php esc_html_e( 'API Endpoint', 'wpshield-collector' ); ?></label></th>
                        <td>
                            <input id="wpshield_api_endpoint" name="wpshield[api_endpoint]" type="url"
                                   value="<?php echo esc_attr( $s['api_endpoint'] ); ?>" class="regular-text" />
                        </td>
                    </tr>
                    <?php endif; ?>
                    <tr>
                        <th scope="row"><label for="wpshield_license_key"><?php esc_html_e( 'License Key', 'wpshield-collector' ); ?></label></th>
                        <td>
                            <input id="wpshield_license_key" name="wpshield[license_key]" type="text"
                                   value="<?php echo esc_attr( $s['license_key'] ); ?>" class="regular-text"
                                   placeholder="<?php esc_attr_e( 'Enter license key to unlock premium features', 'wpshield-collector' ); ?>" />
                            <p class="description">
                                <?php if ( $is_premium ) : ?>
                                    <span style="color:green;">✓ <?php esc_html_e( 'Premium license active', 'wpshield-collector' ); ?></span>
                                <?php elseif ( $is_connected ) : ?>
                                    <?php esc_html_e( 'Enter your license key from the WPShield dashboard to unlock premium features (away mode, IP blocking, geo blocking, full reports).', 'wpshield-collector' ); ?>
                                <?php else : ?>
                                    <?php esc_html_e( 'Have a paid plan? Enter your license key here instead of using Free Connect above.', 'wpshield-collector' ); ?>
                                <?php endif; ?>
                            </p>
                        </td>
                    </tr>
                    <?php if ( ! $is_connected ) : ?>
                    <tr>
                        <th scope="row"><label for="wpshield_api_endpoint_license"><?php esc_html_e( 'API Endpoint', 'wpshield-collector' ); ?></label></th>
                        <td>
                            <input id="wpshield_api_endpoint_license" name="wpshield[api_endpoint]" type="url"
                                   value="<?php echo esc_attr( $s['api_endpoint'] ?: 'https://wpshield-dashboard.onrender.com' ); ?>" class="regular-text" />
                        </td>
                    </tr>
                    <?php endif; ?>
                    <?php if ( $is_connected ) : ?>
                    <tr>
                        <th scope="row"><label for="wpshield_interval"><?php esc_html_e( 'Flush interval', 'wpshield-collector' ); ?></label></th>
                        <td>
                            <select id="wpshield_interval" name="wpshield[flush_interval]">
                                <?php foreach ( WPShield_Settings::all_intervals() as $key ) : ?>
                                    <option value="<?php echo esc_attr( $key ); ?>" <?php selected( $s['flush_interval'], $key ); ?>>
                                        <?php echo esc_html( WPShield_Settings::interval_label( $key ) ); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="wpshield_footer_attribution"><?php esc_html_e( 'Security Badge', 'wpshield-collector' ); ?></label></th>
                        <td>
                            <label>
                                <input type="checkbox" id="wpshield_footer_attribution"
                                       name="wpshield[footer_attribution]" value="1"
                                       <?php checked( ! empty( $s['footer_attribution'] ), true ); ?> />
                                <?php esc_html_e( 'Show "Secured by Cybernara" badge in footer', 'wpshield-collector' ); ?>
                            </label>
                        </td>
                    </tr>
                    <?php endif; ?>
                </table>

                <?php if ( $is_connected ) : ?>
                <h2 class="title"><?php esc_html_e( 'Data Collection', 'wpshield-collector' ); ?></h2>
                <p><?php esc_html_e( 'Select which events WPShield should capture and send to your dashboard.', 'wpshield-collector' ); ?></p>
                <table class="form-table" role="presentation">
                    <?php
                    $checklist_labels = array(
                        'attack_detection' => 'Attack Detection (SQLi, XSS, Path Traversal)',
                        'login_activity'   => 'Login Activity (Successes, Failures, Lockouts)',
                        'user_activity'    => 'User Activity (Plugin installs, Settings changes)',
                        'file_integrity'   => 'File Integrity (Core, Theme, Plugin changes)',
                        'plugin_health'    => 'Plugin Health & Inventory',
                        'theme_health'     => 'Theme Health & Inventory',
                        'core_info'        => 'WordPress Core Info',
                        'malware_scan'     => 'Malware Scanning Results',
                        'user_metadata'    => 'Include User Email & Display Name (Optional)',
                        'request_headers'  => 'Include Raw Request Headers in Attacks (Optional)',
                    );
                    foreach ( $checklist_labels as $key => $label ) :
                        $checked = ! empty( $s['checklist'][ $key ] ) ? 1 : 0;
                    ?>
                        <tr>
                            <th scope="row"><label for="wpshield_check_<?php echo esc_attr( $key ); ?>"><?php echo esc_html( $label ); ?></label></th>
                            <td>
                                <label>
                                    <input type="checkbox" id="wpshield_check_<?php echo esc_attr( $key ); ?>"
                                           name="wpshield[checklist][<?php echo esc_attr( $key ); ?>]" value="1"
                                           <?php checked( $checked, 1 ); ?> />
                                    <?php esc_html_e( 'Enable', 'wpshield-collector' ); ?>
                                </label>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </table>
                <?php endif; ?>

                <p>
                    <input type="hidden" name="wpshield_save" value="1" />
                    <?php submit_button( $is_connected ? __( 'Save Settings', 'wpshield-collector' ) : __( 'Activate License', 'wpshield-collector' ) ); ?>
                </p>
            </form>

            <?php if ( $is_connected ) : ?>
            <hr>
            <h2 class="title"><?php esc_html_e( 'Queue status', 'wpshield-collector' ); ?></h2>
            <p>
                <strong><?php esc_html_e( 'Pending:', 'wpshield-collector' ); ?></strong> <?php echo esc_html( $pending ); ?> &nbsp;|&nbsp;
                <strong><?php esc_html_e( 'Sent:', 'wpshield-collector' ); ?></strong> <?php echo esc_html( $sent ); ?> &nbsp;|&nbsp;
                <strong><?php esc_html_e( 'Failed:', 'wpshield-collector' ); ?></strong> <?php echo esc_html( $failed ); ?>
            </p>
            <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline;">
                <?php wp_nonce_field( 'wpshield_flush_now' ); ?>
                <input type="hidden" name="action" value="wpshield_flush_now" />
                <?php submit_button( __( 'Flush queue now', 'wpshield-collector' ), 'secondary', 'submit', false ); ?>
            </form>
            <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline; margin-left:8px;">
                <?php wp_nonce_field( 'wpshield_test_ping' ); ?>
                <input type="hidden" name="action" value="wpshield_test_ping" />
                <?php submit_button( __( 'Send test ping', 'wpshield-collector' ), 'secondary', 'submit', false ); ?>
            </form>
            <?php endif; ?>
        </div>
        <?php
    }
}
