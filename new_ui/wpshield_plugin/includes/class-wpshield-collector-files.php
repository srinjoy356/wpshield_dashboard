<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * File integrity monitoring.
 *
 * Maintains a baseline of SHA-256 hashes for PHP files in wp-content
 * (themes + plugins + mu-plugins). On each scheduled scan we compare and
 * emit added / modified / deleted events.
 */
class WPShield_Collector_Files {

    public function __construct() {
        add_action( 'wpshield_periodic_scan', array( $this, 'scan' ) );
    }

    public function scan() {
        // Prevent timeouts during extensive file hashing
        @set_time_limit( 0 );

        global $wpdb;
        $table = $wpdb->prefix . WPSHIELD_HASH_TABLE;

        $current = $this->collect_current_hashes();

        $existing = array();
        $rows = $wpdb->get_results( "SELECT file_path, file_hash, file_size FROM {$table}", ARRAY_A );
        foreach ( $rows as $row ) {
            $existing[ $row['file_path'] ] = $row;
        }

        $now = current_time( 'mysql', true );

        // Detect new + modified.
        foreach ( $current as $path => $meta ) {
            if ( ! isset( $existing[ $path ] ) ) {
                // New baseline entry — only flag as "added" after first run.
                if ( ! empty( $existing ) ) {
                    WPShield_Logger::log( 'file', 'medium', array(
                        'event' => 'file_added',
                        'path'  => $this->relative( $path ),
                        'size'  => $meta['size'],
                        'hash'  => $meta['hash'],
                    ) );
                }
                $wpdb->insert( $table, array(
                    'file_path'    => $path,
                    'file_hash'    => $meta['hash'],
                    'file_size'    => $meta['size'],
                    'last_checked' => $now,
                ), array( '%s', '%s', '%d', '%s' ) );

            } elseif ( $existing[ $path ]['file_hash'] !== $meta['hash'] ) {
                WPShield_Logger::log( 'file', 'high', array(
                    'event'    => 'file_modified',
                    'path'     => $this->relative( $path ),
                    'size'     => $meta['size'],
                    'old_hash' => $existing[ $path ]['file_hash'],
                    'new_hash' => $meta['hash'],
                ) );
                $wpdb->update( $table,
                    array( 'file_hash' => $meta['hash'], 'file_size' => $meta['size'], 'last_checked' => $now ),
                    array( 'file_path' => $path ),
                    array( '%s', '%d', '%s' ),
                    array( '%s' )
                );
            }
        }

        // Detect deletions.
        foreach ( $existing as $path => $row ) {
            if ( ! isset( $current[ $path ] ) ) {
                WPShield_Logger::log( 'file', 'medium', array(
                    'event' => 'file_deleted',
                    'path'  => $this->relative( $path ),
                    'hash'  => $row['file_hash'],
                ) );
                $wpdb->delete( $table, array( 'file_path' => $path ), array( '%s' ) );
            }
        }
    }

    /**
     * Walk wp-content for *.php files and hash them.
     * Limits per-scan work to keep things lightweight.
     */
    private function collect_current_hashes() {
        $root  = WP_CONTENT_DIR;
        $out   = array();
        $count = 0;
        $limit = 50000; // Increased to 50000 to ensure all files are scanned in one go

        if ( ! is_dir( $root ) ) {
            return $out;
        }

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator( $root, FilesystemIterator::SKIP_DOTS ),
            RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ( $iterator as $file ) {
            if ( $count >= $limit ) {
                break;
            }
            if ( ! $file->isFile() ) {
                continue;
            }
            $ext = strtolower( $file->getExtension() );
            if ( ! in_array( $ext, array( 'php', 'phtml', 'phar' ), true ) ) {
                continue;
            }
            // Skip cache & upgrade to reduce noise. We WANT to scan uploads for PHP shells!
            $path = $file->getPathname();
            if ( false !== stripos( $path, '/cache/' )    ||
                 false !== stripos( $path, '/upgrade/' ) ) {
                continue;
            }

            $hash = @hash_file( 'sha256', $path );
            if ( false === $hash ) {
                continue;
            }
            $out[ $path ] = array( 'hash' => $hash, 'size' => (int) $file->getSize() );
            $count++;
        }
        return $out;
    }

    private function relative( $path ) {
        return str_replace( ABSPATH, '', $path );
    }
}
