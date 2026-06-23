<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Passive attack signal detector.
 *
 * Read-only by design — we observe and log; we never block.
 * Detects: SQLi/XSS/LFI/RCE patterns in request, suspicious user-agents,
 * 404 floods on sensitive paths, XML-RPC abuse.
 *
 * Only flagged requests are queued and forwarded to the dashboard,
 * keeping bandwidth usage proportional to actual attack traffic.
 * Coraza on the dashboard re-inspects each flagged payload for auto-banning.
 */
class WPShield_Collector_Attack {

    public function __construct() {
        add_action( 'init',              array( $this, 'inspect_request' ), 1 );
        add_action( 'template_redirect', array( $this, 'detect_404_probes' ) );
        add_filter( 'xmlrpc_methods',    array( $this, 'note_xmlrpc' ) );
    }

    public function inspect_request() {
        $uri      = isset( $_SERVER['REQUEST_URI'] )     ? (string) $_SERVER['REQUEST_URI']     : '';
        $query    = isset( $_SERVER['QUERY_STRING'] )    ? (string) $_SERVER['QUERY_STRING']    : '';
        $ua       = isset( $_SERVER['HTTP_USER_AGENT'] ) ? (string) $_SERVER['HTTP_USER_AGENT'] : '';
        $method   = isset( $_SERVER['REQUEST_METHOD'] )  ? strtoupper( $_SERVER['REQUEST_METHOD'] ) : 'GET';
        $haystack = strtolower( urldecode( $uri ) . '?' . urldecode( $query ) );

        $body = '';
        if ( $method === 'POST' ) {
            $body      = file_get_contents( 'php://input', false, null, 0, 8192 ) ?: '';
            $haystack .= strtolower( $body );
        }

        $patterns = array(
            'sqli'      => '/(union\s+select|select\s+.*\s+from|information_schema|sleep\s*\(|benchmark\s*\()/i',
            'xss'       => '/(<script|javascript:|onerror\s*=|onload\s*=)/i',
            'lfi'       => '/(\.\.\/|\/etc\/passwd|\/proc\/self|php:\/\/(input|filter))/i',
            'rce'       => '/(;\s*(wget|curl|bash|sh)\s|\|\s*(wget|curl|bash|sh)\s)/i',
            'wpscan_ua' => '/(wpscan|nikto|sqlmap|nmap|acunetix|nessus)/i',
        );

        foreach ( $patterns as $type => $regex ) {
            $target = ( 'wpscan_ua' === $type ) ? strtolower( $ua ) : $haystack;
            if ( preg_match( $regex, $target ) ) {
                WPShield_Logger::log( 'attack', 'high', array(
                    'pattern_type'   => $type,
                    'ip'             => WPShield_Logger::client_ip(),
                    'request_method' => $method,
                    'request_uri'    => substr( $uri, 0, 500 ),
                    'user_agent'     => substr( $ua, 0, 255 ),
                    'request_body'   => base64_encode( $body ),
                ) );
                return; // one signal per request is enough
            }
        }
    }

    public function detect_404_probes() {
        if ( ! is_404() ) {
            return;
        }
        $uri       = isset( $_SERVER['REQUEST_URI'] ) ? (string) $_SERVER['REQUEST_URI'] : '';
        $sensitive = array( 'wp-config', '.env', '.git', 'phpmyadmin', 'adminer', 'shell.php', 'backup' );
        foreach ( $sensitive as $needle ) {
            if ( false !== stripos( $uri, $needle ) ) {
                WPShield_Logger::log( 'attack', 'medium', array(
                    'pattern_type' => 'sensitive_404',
                    'ip'           => WPShield_Logger::client_ip(),
                    'uri'          => substr( $uri, 0, 500 ),
                    'user_agent'   => isset( $_SERVER['HTTP_USER_AGENT'] ) ? substr( $_SERVER['HTTP_USER_AGENT'], 0, 255 ) : '',
                ) );
                return;
            }
        }
    }

    public function note_xmlrpc( $methods ) {
        WPShield_Logger::log( 'attack', 'low', array(
            'pattern_type' => 'xmlrpc_call',
            'ip'           => WPShield_Logger::client_ip(),
        ) );
        return $methods;
    }
}
