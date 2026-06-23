<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class WPShield_Transmitter {

    /** Max delivery attempts before a row is marked dead. */
    const MAX_ATTEMPTS = 3;

    /** Delete dead rows older than this many days. */
    const CLEANUP_DAYS = 3;

    public static function flush() {
        global $wpdb;
        $table    = $wpdb->prefix . WPSHIELD_QUEUE_TABLE;
        $settings = WPShield_Settings::get();

        if ( empty( $settings['api_endpoint'] ) || empty( $settings['site_token'] ) || empty( $settings['company_id'] ) ) {
            return;
        }

        // Occasionally clean up old dead rows so the table stays lean.
        if ( wp_rand( 1, 20 ) === 1 ) {
            self::cleanup( $table );
        }

        // Re-queue failed rows that haven't hit the retry limit yet.
        $wpdb->query( $wpdb->prepare(
            "UPDATE {$table} SET status = 'pending' WHERE status = 'failed' AND attempts < %d",
            self::MAX_ATTEMPTS
        ) );

        $batch_size = (int) $settings['batch_size'];
        $rows = $wpdb->get_results( $wpdb->prepare(
            "SELECT id, event_type, payload, attempts FROM {$table} WHERE status = 'pending' ORDER BY created_at ASC LIMIT %d",
            $batch_size
        ), ARRAY_A );

        if ( empty( $rows ) ) {
            return;
        }

        $ids     = wp_list_pluck( $rows, 'id' );
        $ids_csv = implode( ',', array_map( 'intval', $ids ) );
        $wpdb->query( "UPDATE {$table} SET status = 'processing', attempts = attempts + 1 WHERE id IN ({$ids_csv})" );

        $success_ids = array();
        $fail_ids    = array();
        $dead_ids    = array();

        foreach ( $rows as $row ) {
            $type    = $row['event_type'];
            $payload = json_decode( $row['payload'], true );

            if ( ! is_array( $payload ) ) {
                $dead_ids[] = $row['id'];
                continue;
            }

            // All event types go to /api/ingest/events except inventory.
            // PHP pre-filters attack traffic so volume is low — only real attack
            // signals reach the dashboard, not all traffic.
            if ( $type === 'inventory' ) {
                $endpoint_path = '/api/ingest/inventory';
            } else {
                $endpoint_path = '/api/ingest/events';
            }

            $endpoint = rtrim( $settings['api_endpoint'], '/' ) . $endpoint_path;

            $payload['company_id'] = $settings['company_id'];
            $payload['site_url']   = get_site_url();

            $args = array(
                'body'    => wp_json_encode( $payload ),
                'headers' => array(
                    'Content-Type'  => 'application/json',
                    'Authorization' => 'Bearer ' . $settings['site_token'],
                ),
                'timeout' => 10,
            );

            $response = wp_remote_post( $endpoint, $args );
            $attempts = (int) $row['attempts'] + 1;

            if ( is_wp_error( $response ) ) {
                if ( $attempts >= self::MAX_ATTEMPTS ) {
                    $dead_ids[] = $row['id'];
                } else {
                    $fail_ids[] = $row['id'];
                }
            } else {
                $code = wp_remote_retrieve_response_code( $response );
                if ( $code >= 200 && $code < 300 ) {
                    $success_ids[] = $row['id'];
                } else {
                    if ( $attempts >= self::MAX_ATTEMPTS ) {
                        $dead_ids[] = $row['id'];
                    } else {
                        $fail_ids[] = $row['id'];
                    }
                }
            }
        }

        if ( ! empty( $success_ids ) ) {
            $csv = implode( ',', $success_ids );
            $wpdb->query( "DELETE FROM {$table} WHERE id IN ({$csv})" );
        }

        if ( ! empty( $fail_ids ) ) {
            $csv = implode( ',', $fail_ids );
            $wpdb->query( "UPDATE {$table} SET status = 'failed' WHERE id IN ({$csv})" );
        }

        if ( ! empty( $dead_ids ) ) {
            $csv = implode( ',', $dead_ids );
            $wpdb->query( "UPDATE {$table} SET status = 'dead' WHERE id IN ({$csv})" );
        }
    }

    private static function cleanup( $table ) {
        $cutoff = gmdate( 'Y-m-d H:i:s', time() - ( self::CLEANUP_DAYS * DAY_IN_SECONDS ) );
        $GLOBALS['wpdb']->query( $GLOBALS['wpdb']->prepare(
            "DELETE FROM {$table} WHERE status = 'dead' AND created_at < %s",
            $cutoff
        ) );
    }
}
