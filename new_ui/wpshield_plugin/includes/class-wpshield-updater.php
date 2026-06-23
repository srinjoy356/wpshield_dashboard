<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class WPShield_Updater {
    private $api_url; // Set dynamically from plugin settings
    private $plugin_slug;
    private $version;
    private $site_token;

    /**
     * Public half of the ECDSA (P-256) keypair used by the dashboard's
     * app/api/admin/plugin/upload/route.ts to sign every release zip.
     *
     * REPLACE THIS with your real public key before relying on update
     * verification — as shipped, this is a placeholder and verification
     * will correctly fail closed (block all updates) rather than silently
     * accept anything, but that means updates won't install at all until
     * the real key is here.
     *
     * To get it: if you already have PLUGIN_SIGNING_PRIVATE_KEY set (base64
     * of a PEM EC private key) wherever your dashboard runs, derive the
     * matching public key with:
     *   echo "<your base64 value>" | base64 -d > private.pem
     *   openssl ec -in private.pem -pubout
     * Paste that output (including the BEGIN/END lines) in place of the
     * placeholder below. If you don't have a keypair yet, generate one with:
     *   openssl ecparam -name prime256v1 -genkey -noout -out private.pem
     *   openssl ec -in private.pem -pubout -out public.pem
     *   base64 -w0 private.pem   # → set this as PLUGIN_SIGNING_PRIVATE_KEY on the dashboard
     * then paste public.pem's contents here.
     */
    private $public_key = <<<'EOT'
-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEG3o9+zqczlR9d/FAFFvMnI1acEU0
KP30Zko3aiRTuEHvhGJfP5LTsEHif7Yj/D6x4nGdmjZMwIyyBihVmWmVdA==
-----END PUBLIC KEY-----
EOT;

    public function __construct( $plugin_slug, $version ) {
        $this->plugin_slug = $plugin_slug;
        $this->version     = $version;

        // Read API endpoint + site token from plugin settings so it always points to the
        // right server and authenticates as this specific site — every other outbound
        // call in this plugin (transmitter, config-sync, installer) sends this same
        // Authorization header; this class was missing it, so /api/plugin/update always
        // returned 401 regardless of version number, and request_info() below silently
        // swallowed that into a plain `false`.
        $settings        = get_option( WPSHIELD_OPTION_KEY, array() );
        $api_endpoint    = isset( $settings['api_endpoint'] ) ? rtrim( $settings['api_endpoint'], '/' ) : 'https://wpshield-dashboard.onrender.com';
        $this->api_url   = $api_endpoint . '/api/plugin/update';
        $this->site_token = isset( $settings['site_token'] ) ? $settings['site_token'] : '';

        add_filter( 'pre_set_site_transient_update_plugins', array( $this, 'check_update' ) );
        add_filter( 'plugins_api', array( $this, 'plugin_info' ), 20, 3 );
        add_filter( 'upgrader_pre_download', array( $this, 'verify_signature_pre_download' ), 10, 4 );
    }

    public function check_update( $transient ) {
        if ( empty( $transient->checked ) ) return $transient;

        $remote = $this->request_info();
        if ( $remote && version_compare( $this->version, $remote->version, '<' ) ) {
            $res = new stdClass();
            $res->slug = $this->plugin_slug;
            $res->plugin = plugin_basename( WPSHIELD_FILE );
            $res->new_version = $remote->version;
            $res->tested = $remote->tested;
            $res->package = $remote->download_url;
            $res->url = $remote->url;
            
            // Store signature + checksum for verification in verify_signature_pre_download()
            update_option( 'wpshield_pending_update_signature', isset( $remote->signature ) ? $remote->signature : '' );
            update_option( 'wpshield_pending_update_checksum',  isset( $remote->sha256 )    ? $remote->sha256    : '' );

            $transient->response[ $res->plugin ] = $res;
        }

        return $transient;
    }

    public function plugin_info( $res, $action, $args ) {
        if ( $action !== 'plugin_information' ) return false;
        if ( $this->plugin_slug !== $args->slug ) return false;

        $remote = $this->request_info();
        if ( ! $remote ) return false;

        $res = new stdClass();
        $res->name = $remote->name;
        $res->slug = $this->plugin_slug;
        $res->version = $remote->version;
        $res->tested = $remote->tested;
        $res->requires = $remote->requires;
        $res->author = $remote->author;
        $res->download_link = $remote->download_url;
        $res->trunk = $remote->download_url;
        $res->sections = array(
            'description' => $remote->sections->description,
            'changelog' => $remote->sections->changelog
        );

        return $res;
    }

    public function verify_signature_pre_download( $reply, $package, $upgrader, $hook_extra ) {
        // Only intercept our own plugin's update — this filter fires for every
        // plugin/theme/core update on the site, not just ours.
        if ( empty( $hook_extra['plugin'] ) || plugin_basename( WPSHIELD_FILE ) !== $hook_extra['plugin'] ) {
            return $reply;
        }

        $signature_b64 = get_option( 'wpshield_pending_update_signature', '' );
        $checksum      = get_option( 'wpshield_pending_update_checksum', '' );

        if ( empty( $signature_b64 ) ) {
            return new WP_Error(
                'wpshield_missing_signature',
                'WPShield update blocked: no signature was provided for this release.'
            );
        }

        if ( false !== strpos( $this->public_key, 'REPLACE_WITH_YOUR_REAL' ) ) {
            // Fail closed, not open — an unconfigured public key must never be treated
            // as "verification not required."
            return new WP_Error(
                'wpshield_unconfigured_key',
                'WPShield update blocked: the plugin signing public key has not been configured yet. See class-wpshield-updater.php for setup instructions.'
            );
        }

        // Download the package ourselves so we can verify it before WordPress ever
        // extracts or installs anything. download_url() is the same core WP helper the
        // default upgrader would have used internally either way.
        $tmp_file = download_url( $package );

        if ( is_wp_error( $tmp_file ) ) {
            return $tmp_file;
        }

        $file_contents = file_get_contents( $tmp_file );
        if ( false === $file_contents ) {
            @unlink( $tmp_file );
            return new WP_Error( 'wpshield_read_failed', 'WPShield update blocked: could not read downloaded package.' );
        }

        // Independent checksum check, alongside (not instead of) signature
        // verification — catches a corrupted/incomplete download distinctly from a
        // cryptographic verification failure, which is a more useful error to surface.
        if ( ! empty( $checksum ) && hash( 'sha256', $file_contents ) !== $checksum ) {
            @unlink( $tmp_file );
            return new WP_Error( 'wpshield_checksum_mismatch', 'WPShield update blocked: downloaded package checksum does not match.' );
        }

        $signature_raw = base64_decode( $signature_b64, true );
        if ( false === $signature_raw ) {
            @unlink( $tmp_file );
            return new WP_Error( 'wpshield_bad_signature_encoding', 'WPShield update blocked: signature was not valid base64.' );
        }

        // ECDSA-SHA256 — must match signRelease() in app/api/admin/plugin/upload/route.ts
        // exactly: that signs the raw zip bytes directly with createSign('SHA256'), which
        // hashes internally, so this must verify against the same raw bytes too rather
        // than a pre-hashed digest.
        $result = openssl_verify( $file_contents, $signature_raw, $this->public_key, OPENSSL_ALGO_SHA256 );

        if ( 1 !== $result ) {
            @unlink( $tmp_file );
            error_log( '[WPShield] Plugin update signature verification failed: ' . openssl_error_string() );
            return new WP_Error(
                'wpshield_signature_invalid',
                'WPShield update blocked: package signature did not verify. The update was not installed to protect this site.'
            );
        }

        // Verified — clear the one-shot pending values and hand WordPress the file we
        // already downloaded and checked, so it doesn't fetch it again unverified.
        delete_option( 'wpshield_pending_update_signature' );
        delete_option( 'wpshield_pending_update_checksum' );

        return $tmp_file;
    }

    private function request_info() {
        if ( empty( $this->site_token ) ) {
            return false; // not activated yet — nothing to authenticate this request with
        }

        $response = wp_remote_get( $this->api_url, array(
            'timeout' => 10,
            'headers' => array(
                'Accept'        => 'application/json',
                'Authorization' => 'Bearer ' . $this->site_token,
            )
        ) );

        if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) !== 200 ) {
            return false;
        }

        $body = wp_remote_retrieve_body( $response );
        return json_decode( $body );
    }
}
