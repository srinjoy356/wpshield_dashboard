<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Outputs a small "Secured by Cybernara" badge in the site footer
 * when the user has opted in via the Security Badge setting.
 * Reads consent from the remote config (same transient as all other
 * features) so it can be toggled from the dashboard too if needed.
 */
class WPShield_Footer_Attribution {

    public function __construct() {
        add_action( 'wp_footer', array( $this, 'maybe_render_badge' ), 999 );
    }

    public function maybe_render_badge() {
        $settings = WPShield_Settings::get();

        // Respect local setting first — if user unchecked it, honour that immediately
        if ( empty( $settings['footer_attribution'] ) ) {
            return;
        }

        // Also respect remote config override (so dashboard can suppress it)
        $config = WPShield_Config_Sync::get();
        if ( isset( $config['footer_attribution'] ) && ! $config['footer_attribution'] ) {
            return;
        }

        $url = 'https://cybernara.com?ref=wpshield&utm_source=footer_badge&utm_medium=referral';
        ?>
        <div id="cybernara-security-badge" style="text-align:center;padding:10px 0 6px;font-size:11px;line-height:1.4;">
            <a href="<?php echo esc_url( $url ); ?>"
               target="_blank"
               rel="noopener noreferrer"
               style="display:inline-flex;align-items:center;gap:5px;color:#107C6B;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;opacity:0.75;transition:opacity 0.2s;"
               onmouseover="this.style.opacity='1'"
               onmouseout="this.style.opacity='0.75'">
                <svg width="13" height="15" viewBox="0 0 35 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">
                    <path d="M17.5,2 L33,8.5 L33,22 C33,33 17.5,40 17.5,40 C17.5,40 2,33 2,22 L2,8.5 Z"
                          fill="#0A1A1A" stroke="#26E6C6" stroke-width="2" stroke-linejoin="round"/>
                    <path d="M10,21 C10,27 13,29 15,24.5 C17,20 18,20 20,24.5 C22,29 25,27 25,21"
                          stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="17.5" cy="13" r="2" fill="#26E6C6"/>
                </svg>
                Secured by Cybernara
            </a>
        </div>
        <?php
    }
}
