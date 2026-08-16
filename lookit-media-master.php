<?php
/**
 * Plugin Name:  Lookit Media Master
 * Description:  A unified media toolkit: Image Resizer & Compressor, Media Library Resizer, and AI-powered Alt Text Manager (AWS Bedrock vision, via the Lookit AI platform, generates alt text by analysing each image).
 * Version:      3.16.1
 * Author:       Lookit Design
 * Author URI:   https://lookitai.com
 * License:      GPL v2 or later
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * Text Domain:  lookit-media-master
 */

defined( 'ABSPATH' ) || exit;

define( 'LMT_VERSION',    '3.16.1' );
define( 'LMT_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'LMT_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );

// ═══════════════════════════════════════════════════════════════
//  ADMIN MENU
// ═══════════════════════════════════════════════════════════════

add_action( 'admin_menu', function () {
    add_menu_page(
        'Lookit Media Master',
        'Media Master',
        'upload_files',
        'lookit-media-master',
        'lmt_render_page',
        'dashicons-format-image',
        58
    );
    add_submenu_page(
        'lookit-media-master',
        'Lookit Media Master Settings',
        'Settings',
        'manage_options',
        'lookit-media-master-settings',
        'lmt_render_settings_page'
    );
} );

// ═══════════════════════════════════════════════════════════════
//  SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════

add_action( 'admin_init', function () {
    register_setting( 'lmt_settings', 'lmt_n8n_endpoint', [
        'sanitize_callback' => 'esc_url_raw',
        'default'           => '',
    ]);
    register_setting( 'lmt_settings', 'lmt_n8n_token', [
        'sanitize_callback' => 'sanitize_text_field',
        'default'           => '',
    ]);
    register_setting( 'lmt_settings', 'lmt_ai_prompt', [
        'sanitize_callback' => 'sanitize_textarea_field',
        'default'           => 'Write a concise, descriptive alt text for this image. Be specific about what is shown. Keep it under 125 characters. Do not start with "Image of" or "Photo of". Return only the alt text, nothing else.',
    ]);
    register_setting( 'lmt_settings', 'lmt_ai_title_prompt', [
        'sanitize_callback' => 'sanitize_textarea_field',
        'default'           => 'Write a short, descriptive title for this image. Use title case. Be specific about the subject. Keep it under 60 characters — suitable as a media library title or page heading. Do not wrap in quotes, do not end with a period, and do not start with phrases like "Image of" or "Photo of". Return only the title, nothing else.',
    ]);
} );

function lmt_render_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) return;
    if ( isset( $_POST['lmt_save_settings'] ) ) {
        check_admin_referer( 'lmt_settings_save' );
        update_option( 'lmt_n8n_endpoint',    esc_url_raw( wp_unslash( $_POST['lmt_n8n_endpoint'] ?? '' ) ) );
        update_option( 'lmt_n8n_token',       sanitize_text_field( wp_unslash( $_POST['lmt_n8n_token'] ?? '' ) ) );
        update_option( 'lmt_ai_prompt',       sanitize_textarea_field( wp_unslash( $_POST['lmt_ai_prompt'] ?? '' ) ) );
        update_option( 'lmt_ai_title_prompt', sanitize_textarea_field( wp_unslash( $_POST['lmt_ai_title_prompt'] ?? '' ) ) );
        echo '<div class="notice notice-success"><p>Settings saved.</p></div>';
    }
    $endpoint     = get_option( 'lmt_n8n_endpoint', '' );
    $token        = get_option( 'lmt_n8n_token', '' );
    $prompt       = get_option( 'lmt_ai_prompt', 'Write a concise, descriptive alt text for this image. Be specific about what is shown. Keep it under 125 characters. Do not start with "Image of" or "Photo of". Return only the alt text, nothing else.' );
    $title_prompt = get_option( 'lmt_ai_title_prompt', 'Write a short, descriptive title for this image. Use title case. Be specific about the subject. Keep it under 60 characters — suitable as a media library title or page heading. Do not wrap in quotes, do not end with a period, and do not start with phrases like "Image of" or "Photo of". Return only the title, nothing else.' );
    $token_masked = $token ? str_repeat( '•', max( 0, strlen( $token ) - 4 ) ) . substr( $token, -4 ) : '';
    ?>
    <div class="wrap">
      <h1 style="margin-bottom:20px;">Lookit Media Master — Settings</h1>
      <form method="post">
        <?php wp_nonce_field( 'lmt_settings_save' ); ?>
        <table class="form-table" role="presentation">

          <tr>
            <th scope="row"><label for="lmt_n8n_endpoint">Lookit AI Endpoint (n8n)</label></th>
            <td>
              <input type="url" id="lmt_n8n_endpoint" name="lmt_n8n_endpoint"
                     value="<?php echo esc_attr( $endpoint ); ?>"
                     class="regular-text" autocomplete="off"
                     placeholder="https://n8n.lookitai.com/webhook/lookit-media-master" />
              <p class="description">
                The Lookit AI platform webhook that generates alt text and titles. All AWS Bedrock
                credentials and model selection live on the platform — never in this plugin.
              </p>
            </td>
          </tr>

          <tr>
            <th scope="row"><label for="lmt_n8n_token">Endpoint Token <span style="font-weight:400;">(optional)</span></label></th>
            <td>
              <input type="password" id="lmt_n8n_token" name="lmt_n8n_token"
                     value="<?php echo esc_attr( $token ); ?>"
                     class="regular-text" autocomplete="off"
                     placeholder="shared secret for the endpoint" />
              <?php if ( $token_masked ) : ?>
                <p class="description">Current token: <code><?php echo esc_html( $token_masked ); ?></code></p>
              <?php endif; ?>
              <p class="description">
                Sent as a <code>Bearer</code> token to the endpoint if your n8n webhook requires one.
                This is a shared secret for the platform — <strong>not</strong> an AWS key.
              </p>
            </td>
          </tr>

          <tr>
            <th scope="row"><label for="lmt_ai_prompt">Alt Text Prompt</label></th>
            <td>
              <textarea id="lmt_ai_prompt" name="lmt_ai_prompt" rows="5" class="large-text"><?php echo esc_textarea( $prompt ); ?></textarea>
              <p class="description">
                Sent to the model with every image. Customise for your brand voice or SEO needs.
                The model should return <strong>only</strong> the alt text — no preamble.
              </p>
            </td>
          </tr>

          <tr>
            <th scope="row"><label for="lmt_ai_title_prompt">Image Title Prompt</label></th>
            <td>
              <textarea id="lmt_ai_title_prompt" name="lmt_ai_title_prompt" rows="5" class="large-text"><?php echo esc_textarea( $title_prompt ); ?></textarea>
              <p class="description">
                Used by the <strong>Title Manager</strong> tab when you click ✨ AI Generate on an image.
                Titles are typically shorter and more headline-style than alt text.
                The model should return <strong>only</strong> the title — no preamble.
              </p>
            </td>
          </tr>

        </table>
        <p class="submit">
          <input type="submit" name="lmt_save_settings" class="button button-primary" value="Save Settings" />
        </p>
      </form>

      <hr>
      <h2>Test Connection</h2>
      <p class="description" style="margin-bottom:10px;">
        Sends a tiny built-in image to your saved endpoint and shows the round-trip result — no media library needed.
        <strong>Save your settings first</strong>, then test.
      </p>
      <p>
        <button type="button" id="lmt-test-btn" class="button">⚡ Test Connection</button>
        <span id="lmt-test-result" style="margin-left:12px;font-weight:600;"></span>
      </p>

      <hr>
      <h2>About the Lookit AI Platform</h2>
      <p>
        This plugin is a thin client. When you generate alt text or a title, it sends the image and
        your prompt to the Lookit AI endpoint (self-hosted n8n), which calls <strong>AWS Bedrock</strong>
        (Amazon Nova Lite vision) and returns the text. AWS credentials, model choice, and usage
        metering all live on the platform — nothing sensitive is stored in WordPress.
      </p>

      <hr>
      <h2>Image Resizer — important</h2>
      <div class="notice notice-warning inline" style="max-width:820px;margin:0;">
        <p>
          <strong>Resizing overwrites files on your server.</strong>
          URLs stay the same but the original high-res file is replaced. Enable "Create backup" in the Image Resizer to keep a copy before resizing — backups can be restored one-by-one. This reminder stays here even if the banner on the Image Resizer tab is dismissed.
        </p>
      </div>
    </div>
    <?php
    // NOTE for Vadim: inline script for prototype speed. For release, move this to
    // an enqueued asset on the settings page and pass the nonce via wp_localize_script.
    $test_nonce = wp_create_nonce( 'lmt_nonce' );
    ?>
    <script>
    (function(){
      var btn = document.getElementById('lmt-test-btn');
      var out = document.getElementById('lmt-test-result');
      if (!btn) return;
      btn.addEventListener('click', function(){
        btn.disabled = true;
        out.style.color = '#666';
        out.textContent = 'Testing…';
        var body = new URLSearchParams({ action: 'lmt_ai_test', nonce: '<?php echo esc_js( $test_nonce ); ?>' });
        fetch(ajaxurl, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: body })
          .then(function(r){ return r.json(); })
          .then(function(res){
            if (res.success) {
              out.style.color = '#46b450';
              out.textContent = '✓ Connected (' + res.data.ms + ' ms) — reply: "' + res.data.reply + '"';
            } else {
              out.style.color = '#dc3232';
              out.textContent = '✗ ' + (res.data || 'Failed');
            }
          })
          .catch(function(err){
            out.style.color = '#dc3232';
            out.textContent = '✗ ' + err.message;
          })
          .finally(function(){ btn.disabled = false; });
      });
    })();
    </script>
    <?php
}

// ═══════════════════════════════════════════════════════════════
//  ENQUEUE ASSETS  (only on our page)
// ═══════════════════════════════════════════════════════════════

add_action( 'admin_enqueue_scripts', function ( $hook ) {
    if ( $hook !== 'toplevel_page_lookit-media-master' ) return;

    wp_enqueue_script( 'jszip', LMT_PLUGIN_URL . 'assets/jszip.min.js', [], '3.10.1', true );
    wp_enqueue_style(  'lmt-styles', LMT_PLUGIN_URL . 'assets/style.css', [], LMT_VERSION );
    wp_enqueue_script( 'lmt-app',    LMT_PLUGIN_URL . 'assets/app.js', [ 'jszip' ], LMT_VERSION, true );

    wp_localize_script( 'lmt-app', 'LMT', [
        'ajax'     => admin_url( 'admin-ajax.php' ),
        'nonce'    => wp_create_nonce( 'lmt_nonce' ),
        'has_key'  => ! empty( get_option( 'lmt_n8n_endpoint', '' ) ),
        'settings' => admin_url( 'admin.php?page=lookit-media-master-settings' ),
    ]);
} );

// ═══════════════════════════════════════════════════════════════
//  AUTO-POPULATE ALT ON UPLOAD
// ═══════════════════════════════════════════════════════════════

add_filter( 'wp_generate_attachment_metadata', function ( $meta, $id ) {
    if ( ! wp_attachment_is_image( $id ) ) return $meta;
    if ( get_post_meta( $id, '_wp_attachment_image_alt', true ) !== '' ) return $meta;
    $file = get_attached_file( $id );
    if ( ! $file || ! file_exists( $file ) ) return $meta;
    $alt = lmt_extract_alt_from_file( $file );
    if ( $alt !== '' ) update_post_meta( $id, '_wp_attachment_image_alt', sanitize_text_field( $alt ) );
    return $meta;
}, 10, 2 );

// ═══════════════════════════════════════════════════════════════
//  METADATA EXTRACTOR  (IPTC → EXIF → XMP)
// ═══════════════════════════════════════════════════════════════

function lmt_extract_alt_from_file( string $file ): string {
    $info = [];
    @getimagesize( $file, $info );
    if ( ! empty( $info['APP13'] ) && is_callable( 'iptcparse' ) ) {
        $iptc = @iptcparse( $info['APP13'] );
        if ( is_array( $iptc ) ) {
            foreach ( [ '2#120', '2#105' ] as $tag ) {
                if ( ! empty( $iptc[ $tag ][0] ) ) {
                    $val = trim( $iptc[ $tag ][0] );
                    if ( $val !== '' ) return $val;
                }
            }
        }
    }
    if ( is_callable( 'exif_read_data' ) ) {
        $exif = @exif_read_data( $file, 'IFD0', false );
        if ( ! empty( $exif['ImageDescription'] ) ) {
            $val = trim( $exif['ImageDescription'] );
            if ( $val !== '' && ! preg_match( '/^[\x00-\x1f]+$/', $val ) ) return $val;
        }
        if ( ! empty( $exif['UserComment'] ) ) {
            $val = trim( preg_replace( '/^(ASCII|UNICODE)\x00*/i', '', $exif['UserComment'] ) );
            $val = trim( $val, "\x00" );
            if ( $val !== '' && strlen( $val ) < 500 ) return $val;
        }
    }
    $raw = @file_get_contents( $file, false, null, 0, 65536 );
    if ( $raw ) {
        if ( preg_match( '/<dc:description[^>]*>.*?<rdf:Alt[^>]*>.*?<rdf:li[^>]*>([^<]{1,500})<\/rdf:li>/si', $raw, $m ) ) {
            $val = trim( html_entity_decode( $m[1], ENT_XML1 | ENT_QUOTES, 'UTF-8' ) );
            if ( $val !== '' ) return $val;
        }
        if ( preg_match( '/dc:description="([^"]{1,500})"/i', $raw, $m ) ) return trim( $m[1] );
    }
    return '';
}

// ═══════════════════════════════════════════════════════════════
//  AJAX — IMAGE RESIZER: UPLOAD COMPRESSED BLOB TO MEDIA LIBRARY
// ═══════════════════════════════════════════════════════════════

add_action( 'wp_ajax_lmt_ir_upload', function () {
    check_ajax_referer( 'lmt_nonce', 'nonce' );
    if ( ! current_user_can( 'upload_files' ) ) wp_send_json_error( [ 'message' => 'Forbidden' ], 403 );

    if ( empty( $_FILES['file'] ) || ! is_array( $_FILES['file'] ) ) {
        wp_send_json_error( [ 'message' => 'No file received.' ], 400 );
    }

    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/media.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';

    $overrides = [ 'test_form' => false ];
    $attachment_id = media_handle_upload( 'file', 0, [], $overrides );

    if ( is_wp_error( $attachment_id ) ) {
        wp_send_json_error( [ 'message' => $attachment_id->get_error_message() ], 500 );
    }

    wp_send_json_success( [
        'id'       => $attachment_id,
        'url'      => wp_get_attachment_url( $attachment_id ),
        'filename' => basename( get_attached_file( $attachment_id ) ),
        'edit'     => get_edit_post_link( $attachment_id, '' ),
    ] );
} );

// ═══════════════════════════════════════════════════════════════
//  AJAX — ALT TEXT: GET BATCH
// ═══════════════════════════════════════════════════════════════

add_action( 'wp_ajax_lmt_alt_get_batch', function () {
    check_ajax_referer( 'lmt_nonce', 'nonce' );
    if ( ! current_user_can( 'upload_files' ) ) wp_die( 'Forbidden', 403 );

    $page         = max( 1, intval( $_POST['page'] ?? 1 ) );
    $per_page_raw = sanitize_text_field( wp_unslash( $_POST['per_page'] ?? '30' ) );
    $per_page     = ( $per_page_raw === 'all' ) ? -1 : min( 500, max( 1, intval( $per_page_raw ) ) );
    $filter       = sanitize_text_field( wp_unslash( $_POST['filter'] ?? 'all' ) );
    $search       = sanitize_text_field( wp_unslash( $_POST['search'] ?? '' ) );
    $sort         = sanitize_text_field( wp_unslash( $_POST['sort'] ?? 'date_desc' ) );
    $type         = sanitize_text_field( wp_unslash( $_POST['type'] ?? 'all' ) );

    $type_map = [ 'jpg' => [ 'image/jpeg' ], 'png' => [ 'image/png' ], 'webp' => [ 'image/webp' ] ];
    $mime     = $type_map[ $type ] ?? 'image';

    $orderby = 'date'; $order = 'DESC'; $sort_meta = '';
    switch ( $sort ) {
        case 'name_asc':  $orderby = 'meta_value'; $sort_meta = '_wp_attached_file'; $order = 'ASC';  break;
        case 'name_desc': $orderby = 'meta_value'; $sort_meta = '_wp_attached_file'; $order = 'DESC'; break;
        case 'date_asc':  $order = 'ASC'; break;
    }

    $args = [
        'post_type'      => 'attachment',
        'post_mime_type' => $mime,
        'post_status'    => 'inherit',
        'posts_per_page' => $per_page,
        'paged'          => $page,
        'fields'         => 'ids',
        'orderby'        => $orderby,
        'order'          => $order,
    ];
    if ( $sort_meta !== '' ) {
        $args['meta_key'] = $sort_meta; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- admin-only sort by filename.
    }

    if ( $filter === 'missing' ) {
        // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- filtering attachments by missing/empty alt text; admin-only Alt Manager screen.
        $args['meta_query'] = [ 'relation' => 'OR',
            [ 'key' => '_wp_attachment_image_alt', 'value' => '', 'compare' => '=' ],
            [ 'key' => '_wp_attachment_image_alt', 'compare' => 'NOT EXISTS' ],
        ];
    } elseif ( $filter === 'has' ) {
        // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- filtering attachments that have non-empty alt text; admin-only Alt Manager screen.
        $args['meta_query'] = [
            [ 'key' => '_wp_attachment_image_alt', 'value' => '', 'compare' => '!=' ],
        ];
    }

    if ( $search !== '' ) {
        $args['s'] = $search;
    }

    $query = new WP_Query( $args );
    $ids   = $query->posts;
    $total = $query->found_posts;

    $items = [];
    foreach ( $ids as $id ) {
        $thumb = wp_get_attachment_image_url( $id, 'medium_large' ) ?: '';
        $alt   = get_post_meta( $id, '_wp_attachment_image_alt', true );
        $file  = get_attached_file( $id );
        $meta  = wp_get_attachment_metadata( $id );
        $post  = get_post( $id );
        $items[] = [
            'id'       => $id,
            'thumb'    => $thumb,
            'filename' => $file ? basename( $file ) : '',
            'alt'      => $alt,
            'has_alt'  => ( $alt !== '' && $alt !== false ),
            'is_auto'  => lmt_is_auto_title( $id ),
            'used'     => lmt_attachment_usage_count( $id ),
            'title'    => $post ? (string) $post->post_title : '',
            'width'    => $meta['width'] ?? 0,
            'height'   => $meta['height'] ?? 0,
        ];
    }

    wp_send_json_success( [
        'items'    => $items,
        'total'    => $total,
        'page'     => $page,
        'pages'    => ( $per_page < 1 ) ? 1 : (int) ceil( $total / $per_page ),
        'per_page' => $per_page,
    ] );
} );

// ═══════════════════════════════════════════════════════════════
//  AJAX — ALT TEXT: SAVE SINGLE
// ═══════════════════════════════════════════════════════════════

add_action( 'wp_ajax_lmt_alt_save', function () {
    check_ajax_referer( 'lmt_nonce', 'nonce' );
    if ( ! current_user_can( 'upload_files' ) ) wp_die( 'Forbidden', 403 );

    $id  = intval( $_POST['id'] ?? 0 );
    $alt = sanitize_text_field( wp_unslash( $_POST['alt'] ?? '' ) );
    if ( ! $id ) wp_send_json_error( 'Invalid ID' );

    update_post_meta( $id, '_wp_attachment_image_alt', $alt );
    wp_send_json_success( [ 'id' => $id, 'alt' => $alt ] );
} );

// ═══════════════════════════════════════════════════════════════
//  AJAX — ALT TEXT: BULK PROCESS ONE
// ═══════════════════════════════════════════════════════════════

add_action( 'wp_ajax_lmt_alt_process_one', function () {
    check_ajax_referer( 'lmt_nonce', 'nonce' );
    if ( ! current_user_can( 'upload_files' ) ) wp_die( 'Forbidden', 403 );

    $id        = intval( $_POST['id'] ?? 0 );
    $overwrite = ( sanitize_text_field( wp_unslash( $_POST['overwrite'] ?? '0' ) ) === '1' );
    if ( ! $id ) wp_send_json_error( 'Invalid ID' );

    $existing = get_post_meta( $id, '_wp_attachment_image_alt', true );
    if ( ! $overwrite && $existing !== '' && $existing !== false ) {
        wp_send_json_success( [ 'id' => $id, 'alt' => $existing, 'skipped' => true ] );
    }

    $post = get_post( $id );
    $alt  = $post ? sanitize_text_field( $post->post_title ) : '';
    if ( $alt !== '' ) {
        update_post_meta( $id, '_wp_attachment_image_alt', $alt );
        wp_send_json_success( [ 'id' => $id, 'alt' => $alt, 'skipped' => false ] );
    } else {
        wp_send_json_success( [ 'id' => $id, 'alt' => '', 'skipped' => false, 'no_meta' => true ] );
    }
} );

// ═══════════════════════════════════════════════════════════════
//  AJAX — ALT TEXT: STATS
// ═══════════════════════════════════════════════════════════════

add_action( 'wp_ajax_lmt_alt_stats', function () {
    check_ajax_referer( 'lmt_nonce', 'nonce' );
    if ( ! current_user_can( 'upload_files' ) ) wp_die( 'Forbidden', 403 );

    $total = ( new WP_Query( [
        'post_type' => 'attachment', 'post_mime_type' => 'image',
        'post_status' => 'inherit', 'posts_per_page' => -1, 'fields' => 'ids',
    ] ) )->found_posts;

    $missing = ( new WP_Query( [
        'post_type' => 'attachment', 'post_mime_type' => 'image',
        'post_status' => 'inherit', 'posts_per_page' => -1, 'fields' => 'ids',
        // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- alt-text stats query; admin-only.
        'meta_query' => [ 'relation' => 'OR',
            [ 'key' => '_wp_attachment_image_alt', 'value' => '', 'compare' => '=' ],
            [ 'key' => '_wp_attachment_image_alt', 'compare' => 'NOT EXISTS' ],
        ],
    ] ) )->found_posts;

    wp_send_json_success( [ 'total' => $total, 'missing' => $missing, 'has_alt' => $total - $missing ] );
} );

// ═══════════════════════════════════════════════════════════════
//  AJAX — ALT TEXT: GET ALL IDS FOR BULK
// ═══════════════════════════════════════════════════════════════

add_action( 'wp_ajax_lmt_alt_get_all_ids', function () {
    check_ajax_referer( 'lmt_nonce', 'nonce' );
    if ( ! current_user_can( 'upload_files' ) ) wp_die( 'Forbidden', 403 );

    $overwrite = ( sanitize_text_field( wp_unslash( $_POST['overwrite'] ?? '0' ) ) === '1' );
    $args = [
        'post_type'      => 'attachment',
        'post_mime_type' => 'image',
        'post_status'    => 'inherit',
        'posts_per_page' => -1,
        'fields'         => 'ids',
        'orderby'        => 'date',
        'order'          => 'DESC',
    ];
    if ( ! $overwrite ) {
        // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- filtering attachments by missing/empty alt text; admin-only Alt Manager screen.
        $args['meta_query'] = [ 'relation' => 'OR',
            [ 'key' => '_wp_attachment_image_alt', 'value' => '', 'compare' => '=' ],
            [ 'key' => '_wp_attachment_image_alt', 'compare' => 'NOT EXISTS' ],
        ];
    }
    $ids = ( new WP_Query( $args ) )->posts;
    wp_send_json_success( [ 'ids' => $ids, 'total' => count( $ids ) ] );
} );

// ═══════════════════════════════════════════════════════════════
//  HELPER — detect an auto-generated post title.
//  WordPress sets post_title to the filename (without extension)
//  on upload. We consider a title "auto" if it matches the raw
//  basename or the sanitized version of it. Anything else is
//  treated as human-curated.
// ═══════════════════════════════════════════════════════════════

function lmt_is_auto_title( $post_id ) {
    $post = get_post( $post_id );
    if ( ! $post ) return true;

    $title = (string) $post->post_title;
    if ( $title === '' ) return true;

    $file = get_attached_file( $post_id );
    if ( ! $file ) return false;

    $basename = pathinfo( $file, PATHINFO_FILENAME );
    if ( $basename === '' ) return false;

    if ( $title === $basename )                  return true;
    if ( $title === sanitize_title( $basename ) ) return true;

    return false;
}

// ═══════════════════════════════════════════════════════════════
//  HELPER — count published/draft posts & pages that use an image
//  Matches: the "wp-image-{id}" class WordPress adds to inserted
//  images, the file basename in content, and featured-image use
//  (_thumbnail_id). One prepared query per attachment.
//  NOTE for Vadim: fine at prototype scale (per-page batch), but on
//  large sites this should be cached (e.g. a transient per attachment
//  invalidated on save_post) rather than run live on every load.
// ═══════════════════════════════════════════════════════════════

function lmt_attachment_usage_count( $id ) {
    global $wpdb;

    $id   = (int) $id;
    $file = get_attached_file( $id );
    $base = $file ? basename( $file ) : '';

    $like_class = '%' . $wpdb->esc_like( 'wp-image-' . $id ) . '%';
    $like_file  = $base !== '' ? '%' . $wpdb->esc_like( $base ) . '%' : '%__lmt_no_match__%';

    // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- admin-only usage count; caching noted for production hardening.
    $count = $wpdb->get_var( $wpdb->prepare(
        "SELECT COUNT(DISTINCT p.ID)
           FROM {$wpdb->posts} p
          WHERE p.post_status IN ('publish','draft','private','future','pending')
            AND p.post_type NOT IN ('attachment','revision','nav_menu_item')
            AND (
                 p.post_content LIKE %s
              OR p.post_content LIKE %s
              OR p.ID IN (
                   SELECT pm.post_id FROM {$wpdb->postmeta} pm
                    WHERE pm.meta_key = '_thumbnail_id' AND pm.meta_value = %d
                 )
            )",
        $like_class, $like_file, $id
    ) );

    return (int) $count;
}

// ═══════════════════════════════════════════════════════════════
//  AJAX — USAGE LIST: posts/pages that embed a given attachment
// ═══════════════════════════════════════════════════════════════

add_action( 'wp_ajax_lmt_usage_list', function () {
    check_ajax_referer( 'lmt_nonce', 'nonce' );
    if ( ! current_user_can( 'upload_files' ) ) wp_die( 'Forbidden', 403 );

    global $wpdb;
    $id = intval( $_POST['id'] ?? 0 );
    if ( ! $id ) wp_send_json_error( 'Missing attachment id' );

    $file = get_attached_file( $id );
    $base = $file ? basename( $file ) : '';
    $like_class = '%' . $wpdb->esc_like( 'wp-image-' . $id ) . '%';
    $like_file  = $base !== '' ? '%' . $wpdb->esc_like( $base ) . '%' : '%__lmt_no_match__%';

    // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- admin-only usage list; caching noted for production hardening.
    $rows = $wpdb->get_results( $wpdb->prepare(
        "SELECT DISTINCT p.ID, p.post_title, p.post_type, p.post_status
           FROM {$wpdb->posts} p
          WHERE p.post_status IN ('publish','draft','private','future','pending')
            AND p.post_type NOT IN ('attachment','revision','nav_menu_item')
            AND (
                 p.post_content LIKE %s
              OR p.post_content LIKE %s
              OR p.ID IN (
                   SELECT pm.post_id FROM {$wpdb->postmeta} pm
                    WHERE pm.meta_key = '_thumbnail_id' AND pm.meta_value = %d
                 )
            )
          ORDER BY p.post_type ASC, p.post_title ASC
          LIMIT 100",
        $like_class, $like_file, $id
    ) );

    $items = [];
    foreach ( (array) $rows as $r ) {
        $type_obj = get_post_type_object( $r->post_type );
        $items[] = [
            'id'     => (int) $r->ID,
            'title'  => $r->post_title !== '' ? $r->post_title : '(no title)',
            'type'   => $type_obj ? $type_obj->labels->singular_name : $r->post_type,
            'status' => $r->post_status,
            'view'   => get_permalink( $r->ID ) ?: '',
            'edit'   => get_edit_post_link( $r->ID, 'raw' ) ?: '',
        ];
    }

    wp_send_json_success( [ 'items' => $items ] );
} );

// ═══════════════════════════════════════════════════════════════
//  AJAX — TITLE: GET BATCH
// ═══════════════════════════════════════════════════════════════

add_action( 'wp_ajax_lmt_title_get_batch', function () {
    check_ajax_referer( 'lmt_nonce', 'nonce' );
    if ( ! current_user_can( 'upload_files' ) ) wp_die( 'Forbidden', 403 );

    $page         = max( 1, intval( $_POST['page'] ?? 1 ) );
    $per_page_raw = sanitize_text_field( wp_unslash( $_POST['per_page'] ?? '30' ) );
    $per_page     = ( $per_page_raw === 'all' ) ? -1 : min( 500, max( 1, intval( $per_page_raw ) ) );
    $filter       = sanitize_text_field( wp_unslash( $_POST['filter'] ?? 'all' ) );
    $search       = sanitize_text_field( wp_unslash( $_POST['search'] ?? '' ) );
    $sort         = sanitize_text_field( wp_unslash( $_POST['sort'] ?? 'date_desc' ) );
    $type         = sanitize_text_field( wp_unslash( $_POST['type'] ?? 'all' ) );

    $type_map = [ 'jpg' => [ 'image/jpeg' ], 'png' => [ 'image/png' ], 'webp' => [ 'image/webp' ] ];
    $mime     = $type_map[ $type ] ?? 'image';

    $orderby = 'date'; $order = 'DESC'; $sort_meta = '';
    switch ( $sort ) {
        case 'name_asc':  $orderby = 'meta_value'; $sort_meta = '_wp_attached_file'; $order = 'ASC';  break;
        case 'name_desc': $orderby = 'meta_value'; $sort_meta = '_wp_attached_file'; $order = 'DESC'; break;
        case 'date_asc':  $order = 'ASC'; break;
    }

    // We can't filter "auto vs custom" in SQL cleanly (post_title vs filename
    // requires per-row comparison), so we over-fetch and filter in PHP when
    // filter=auto or filter=custom. For 'all' we paginate normally.
    if ( $filter === 'auto' || $filter === 'custom' ) {
        $all_args = [
            'post_type'      => 'attachment',
            'post_mime_type' => $mime,
            'post_status'    => 'inherit',
            'posts_per_page' => -1,
            'fields'         => 'ids',
            'orderby'        => $orderby,
            'order'          => $order,
        ];
        if ( $sort_meta !== '' ) $all_args['meta_key'] = $sort_meta; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- admin-only sort by filename.
        if ( $search !== '' ) $all_args['s'] = $search;
        $all_ids = ( new WP_Query( $all_args ) )->posts;

        $matched = [];
        foreach ( $all_ids as $aid ) {
            $is_auto = lmt_is_auto_title( $aid );
            if ( ( $filter === 'auto' && $is_auto ) || ( $filter === 'custom' && ! $is_auto ) ) {
                $matched[] = $aid;
            }
        }

        $total  = count( $matched );
        if ( $per_page < 1 ) {
            $ids = $matched;
        } else {
            $offset = ( $page - 1 ) * $per_page;
            $ids    = array_slice( $matched, $offset, $per_page );
        }
    } else {
        $args = [
            'post_type'      => 'attachment',
            'post_mime_type' => $mime,
            'post_status'    => 'inherit',
            'posts_per_page' => $per_page,
            'paged'          => $page,
            'fields'         => 'ids',
            'orderby'        => $orderby,
            'order'          => $order,
        ];
        if ( $sort_meta !== '' ) $args['meta_key'] = $sort_meta; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- admin-only sort by filename.
        if ( $search !== '' ) $args['s'] = $search;
        $query = new WP_Query( $args );
        $ids   = $query->posts;
        $total = $query->found_posts;
    }

    $items = [];
    foreach ( $ids as $id ) {
        $thumb = wp_get_attachment_image_url( $id, 'medium_large' ) ?: '';
        $post  = get_post( $id );
        $title = $post ? (string) $post->post_title : '';
        $file  = get_attached_file( $id );
        $meta  = wp_get_attachment_metadata( $id );
        $items[] = [
            'id'        => $id,
            'thumb'     => $thumb,
            'filename'  => $file ? basename( $file ) : '',
            'title'     => $title,
            'is_auto'   => lmt_is_auto_title( $id ),
            'has_alt'   => ( get_post_meta( $id, '_wp_attachment_image_alt', true ) ? true : false ),
            'used'      => lmt_attachment_usage_count( $id ),
            'width'     => $meta['width']  ?? 0,
            'height'    => $meta['height'] ?? 0,
        ];
    }

    wp_send_json_success( [
        'items'    => $items,
        'total'    => $total,
        'page'     => $page,
        'pages'    => ( $per_page < 1 ) ? 1 : max( 1, (int) ceil( $total / $per_page ) ),
        'per_page' => $per_page,
    ] );
} );

// ═══════════════════════════════════════════════════════════════
//  AJAX — TITLE: SAVE SINGLE
// ═══════════════════════════════════════════════════════════════

add_action( 'wp_ajax_lmt_title_save', function () {
    check_ajax_referer( 'lmt_nonce', 'nonce' );
    if ( ! current_user_can( 'upload_files' ) ) wp_die( 'Forbidden', 403 );

    $id    = intval( $_POST['id'] ?? 0 );
    $title = sanitize_text_field( wp_unslash( $_POST['title'] ?? '' ) );
    if ( ! $id ) wp_send_json_error( 'Invalid ID' );

    $result = wp_update_post( [
        'ID'         => $id,
        'post_title' => $title,
    ], true );

    if ( is_wp_error( $result ) ) {
        wp_send_json_error( $result->get_error_message() );
    }

    wp_send_json_success( [
        'id'      => $id,
        'title'   => $title,
        'is_auto' => lmt_is_auto_title( $id ),
    ] );
} );

// ═══════════════════════════════════════════════════════════════
//  AJAX — TITLE: STATS
// ═══════════════════════════════════════════════════════════════

add_action( 'wp_ajax_lmt_title_stats', function () {
    check_ajax_referer( 'lmt_nonce', 'nonce' );
    if ( ! current_user_can( 'upload_files' ) ) wp_die( 'Forbidden', 403 );

    $all_ids = ( new WP_Query( [
        'post_type'      => 'attachment',
        'post_mime_type' => 'image',
        'post_status'    => 'inherit',
        'posts_per_page' => -1,
        'fields'         => 'ids',
    ] ) )->posts;

    $total = count( $all_ids );
    $auto  = 0;
    foreach ( $all_ids as $aid ) {
        if ( lmt_is_auto_title( $aid ) ) $auto++;
    }

    wp_send_json_success( [
        'total'  => $total,
        'auto'   => $auto,
        'custom' => $total - $auto,
    ] );
} );

// ═══════════════════════════════════════════════════════════════
//  AJAX — AI TITLE: GENERATE VIA LOOKIT AI PLATFORM (n8n → Bedrock)
//  Uses the separate `lmt_ai_title_prompt` setting; model choice
//  and metering live on the Lookit AI platform (n8n).
// ═══════════════════════════════════════════════════════════════

add_action( 'wp_ajax_lmt_ai_title_generate', function () {
    check_ajax_referer( 'lmt_nonce', 'nonce' );
    if ( ! current_user_can( 'upload_files' ) ) wp_die( 'Forbidden', 403 );

    $id = intval( $_POST['id'] ?? 0 );
    if ( ! $id ) wp_send_json_error( 'Invalid ID' );

    $endpoint = get_option( 'lmt_n8n_endpoint', '' );
    if ( ! $endpoint ) wp_send_json_error( 'No Lookit AI endpoint set. Go to Media Master → Settings.' );
    $token = get_option( 'lmt_n8n_token', '' );

    $prompt = get_option( 'lmt_ai_title_prompt', 'Write a short, descriptive title for this image. Use title case. Be specific about the subject. Keep it under 60 characters — suitable as a media library title or page heading. Do not wrap in quotes, do not end with a period, and do not start with phrases like "Image of" or "Photo of". Return only the title, nothing else.' );

    $file = get_attached_file( $id );
    if ( ! $file || ! file_exists( $file ) ) wp_send_json_error( 'Image file not found on disk' );

    if ( filesize( $file ) > 4 * 1024 * 1024 ) {
        $upload_dir = wp_upload_dir();
        $thumb_url  = wp_get_attachment_image_url( $id, 'medium' );
        if ( $thumb_url ) {
            $rel = str_replace( $upload_dir['baseurl'], $upload_dir['basedir'], $thumb_url );
            if ( file_exists( $rel ) ) $file = $rel;
        }
    }
    if ( filesize( $file ) > 10 * 1024 * 1024 ) {
        wp_send_json_error( 'Image too large (>10 MB even after thumbnail fallback).' );
    }

    $mime          = mime_content_type( $file ) ?: get_post_mime_type( $id );
    $allowed_mimes = [ 'image/jpeg', 'image/png', 'image/gif', 'image/webp' ];
    if ( ! in_array( $mime, $allowed_mimes, true ) ) {
        wp_send_json_error( 'Unsupported image type: ' . $mime );
    }

    $raw = file_get_contents( $file );
    if ( ! $raw ) wp_send_json_error( 'Could not read image file' );
    $data_uri = 'data:' . $mime . ';base64,' . base64_encode( $raw );

    $result = lmt_n8n_call( $endpoint, $token, $data_uri, $mime, $prompt );
    if ( $result['ok'] ) {
        $title = $result['alt']; // helper returns the text under the 'alt' key
        $save  = ( sanitize_text_field( wp_unslash( $_POST['save'] ?? '0' ) ) === '1' );
        if ( $save ) {
            $upd = wp_update_post( [
                'ID'         => $id,
                'post_title' => sanitize_text_field( $title ),
            ], true );
            if ( is_wp_error( $upd ) ) {
                wp_send_json_error( 'AI ok but title save failed: ' . $upd->get_error_message() );
            }
        }
        wp_send_json_success( [
            'id'      => $id,
            'title'   => $title,
            'saved'   => $save,
            'is_auto' => $save ? lmt_is_auto_title( $id ) : true,
        ] );
        return;
    }

    wp_send_json_error( 'AI generation failed: ' . $result['error'] );
} );

// ═══════════════════════════════════════════════════════════════
//  AJAX — MEDIA LIBRARY RESIZE: GET IMAGES
// ═══════════════════════════════════════════════════════════════

add_action( 'wp_ajax_lmt_mlr_get_images', function () {
    check_ajax_referer( 'lmt_nonce', 'nonce' );
    if ( ! current_user_can( 'upload_files' ) ) wp_die( 'Forbidden', 403 );

    $page         = max( 1, intval( $_POST['page'] ?? 1 ) );
    $per_page_raw = sanitize_text_field( wp_unslash( $_POST['per_page'] ?? '30' ) );
    $per_page     = ( $per_page_raw === 'all' ) ? -1 : min( 500, max( 1, intval( $per_page_raw ) ) );
    $search       = sanitize_text_field( wp_unslash( $_POST['search'] ?? '' ) );
    $filter       = sanitize_text_field( wp_unslash( $_POST['filter'] ?? 'all' ) );
    $sort         = sanitize_text_field( wp_unslash( $_POST['sort'] ?? 'date_desc' ) );
    $type         = sanitize_text_field( wp_unslash( $_POST['type'] ?? 'all' ) );

    $type_map = [
        'jpg'  => [ 'image/jpeg' ],
        'png'  => [ 'image/png' ],
        'webp' => [ 'image/webp' ],
    ];
    $mime = $type_map[ $type ] ?? [ 'image/jpeg', 'image/png', 'image/webp' ];

    $args = [
        'post_type'      => 'attachment',
        'post_mime_type' => $mime,
        'post_status'    => 'inherit',
        'posts_per_page' => $per_page,
        'paged'          => $page,
        'fields'         => 'ids',
        'orderby'        => 'date',
        'order'          => 'DESC',
    ];

    // Sort: filename A-Z / Z-A orders by the stored file path (_wp_attached_file);
    // for a library uploaded into the same folder this orders by filename.
    switch ( $sort ) {
        case 'name_asc':
            $args['orderby']  = 'meta_value';
            $args['meta_key'] = '_wp_attached_file'; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- admin-only sort by filename.
            $args['order']    = 'ASC';
            break;
        case 'name_desc':
            $args['orderby']  = 'meta_value';
            $args['meta_key'] = '_wp_attached_file'; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- admin-only sort by filename.
            $args['order']    = 'DESC';
            break;
        case 'date_asc':
            $args['order'] = 'ASC';
            break;
        // 'date_desc' is the default already set above.
    }

    if ( $search !== '' ) $args['s'] = $search;

    $query      = new WP_Query( $args );
    $ids        = $query->posts;
    $real_total = $query->found_posts;

    $items   = [];
    $skipped = 0;
    foreach ( $ids as $id ) {
        $meta     = wp_get_attachment_metadata( $id );
        $file     = get_attached_file( $id );
        $filesize = $file && file_exists( $file ) ? filesize( $file ) : 0;
        $thumb    = wp_get_attachment_image_url( $id, 'medium_large' ) ?: '';
        $mime     = get_post_mime_type( $id );
        $w        = $meta['width']  ?? 0;
        $h        = $meta['height'] ?? 0;
        $has_backup = $file && file_exists( $file . '.lmt-backup' );

        // Large filter: skip images whose longest edge is already ≤ 1200px
        if ( $filter === 'large' && max( $w, $h ) <= 1200 ) {
            $skipped++;
            continue;
        }

        $items[] = [
            'id'         => $id,
            'thumb'      => $thumb,
            'filename'   => $file ? basename( $file ) : '',
            'width'      => $w,
            'height'     => $h,
            'filesize'   => $filesize,
            'mime'       => $mime,
            'has_backup' => $has_backup,
            'has_alt'    => ( get_post_meta( $id, '_wp_attachment_image_alt', true ) ? true : false ),
            'is_auto'    => lmt_is_auto_title( $id ),
            'used'       => lmt_attachment_usage_count( $id ),
        ];
    }

    $total = $real_total - $skipped;
    $pages = ( $per_page < 1 ) ? 1 : max( 1, (int) ceil( $real_total / $per_page ) );

    wp_send_json_success( [
        'items'    => $items,
        'total'    => $total,
        'page'     => $page,
        'pages'    => $pages,
        'per_page' => $per_page,
    ] );
} );

// ═══════════════════════════════════════════════════════════════
//  AJAX — MEDIA LIBRARY RESIZE: FETCH FULL IMAGE AS BASE64
//  JS calls this per-image; PHP reads file from disk → base64
//  Avoids all CORS / auth issues with direct URL fetching
// ═══════════════════════════════════════════════════════════════

add_action( 'wp_ajax_lmt_mlr_get_image_data', function () {
    check_ajax_referer( 'lmt_nonce', 'nonce' );
    if ( ! current_user_can( 'upload_files' ) ) wp_die( 'Forbidden', 403 );

    $id = intval( $_POST['id'] ?? 0 );
    if ( ! $id ) wp_send_json_error( 'Invalid ID' );

    if ( ! wp_attachment_is_image( $id ) ) wp_send_json_error( 'Not an image' );

    $file = get_attached_file( $id );
    if ( ! $file || ! file_exists( $file ) ) wp_send_json_error( 'File not found on disk' );

    // Safety cap — skip files over 25 MB to avoid PHP memory issues
    $size = filesize( $file );
    if ( $size > 25 * 1024 * 1024 ) {
        wp_send_json_error( 'File too large (> 25 MB). Resize manually first.' );
    }

    $mime    = get_post_mime_type( $id ) ?: mime_content_type( $file );
    $raw     = file_get_contents( $file );
    if ( $raw === false ) wp_send_json_error( 'Could not read file' );

    $b64     = base64_encode( $raw );
    $dataUri = 'data:' . $mime . ';base64,' . $b64;

    wp_send_json_success( [
        'id'      => $id,
        'mime'    => $mime,
        'data'    => $dataUri,
        'size'    => $size,
    ] );
} );

// ═══════════════════════════════════════════════════════════════
//  AJAX — MEDIA LIBRARY RESIZE: SAVE RESIZED IMAGE
//  Receives base64 blob, writes over original file, regenerates thumbs
// ═══════════════════════════════════════════════════════════════

add_action( 'wp_ajax_lmt_mlr_save', function () {
    check_ajax_referer( 'lmt_nonce', 'nonce' );
    if ( ! current_user_can( 'upload_files' ) ) wp_die( 'Forbidden', 403 );

    $id      = intval( $_POST['id'] ?? 0 );
    // Validated below by a strict data-URI regex and base64_decode(); sanitize_text_field()
    // would corrupt the base64 payload, so we only unslash here.
    // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
    $data    = isset( $_POST['data'] ) ? wp_unslash( $_POST['data'] ) : '';   // base64 data URI
    $backup  = ( sanitize_text_field( wp_unslash( $_POST['backup'] ?? '1' ) ) === '1' );

    if ( ! $id || ! $data ) wp_send_json_error( 'Missing data' );

    // Validate it's an image attachment
    if ( ! wp_attachment_is_image( $id ) ) wp_send_json_error( 'Not an image' );

    $file = get_attached_file( $id );
    if ( ! $file || ! file_exists( $file ) ) wp_send_json_error( 'File not found' );

    // Strip data URI prefix  e.g. "data:image/webp;base64,"
    if ( ! preg_match( '/^data:image\/(\w+);base64,(.+)$/s', $data, $m ) ) {
        wp_send_json_error( 'Invalid data URI' );
    }
    $ext_from_data = strtolower( $m[1] );
    $raw           = base64_decode( $m[2] );
    if ( ! $raw ) wp_send_json_error( 'Base64 decode failed' );

    // Backup original if requested
    if ( $backup ) {
        $backup_path = $file . '.lmt-backup';
        if ( ! file_exists( $backup_path ) ) { // only backup once — keep the true original
            copy( $file, $backup_path );
        }
    }

    // Write the new file over the original path
    // (keep original extension — same URL)
    $bytes = file_put_contents( $file, $raw );
    if ( $bytes === false ) wp_send_json_error( 'Write failed — check file permissions' );

    // Regenerate WordPress thumbnail sizes
    require_once ABSPATH . 'wp-admin/includes/image.php';
    $metadata = wp_generate_attachment_metadata( $id, $file );
    wp_update_attachment_metadata( $id, $metadata );

    $new_size = filesize( $file );

    wp_send_json_success( [
        'id'       => $id,
        'filename' => basename( $file ),
        'width'    => $metadata['width'] ?? 0,
        'height'   => $metadata['height'] ?? 0,
        'filesize' => $new_size,
        'backed_up'=> $backup,
    ] );
} );

// ═══════════════════════════════════════════════════════════════
//  AJAX — MEDIA LIBRARY RESIZE: SAVE AS NEW WEBP COPY
//  Creates a brand-new .webp attachment from the resized canvas data.
//  The original file/attachment is left untouched, so existing URLs
//  never break. Alt text is copied to the new attachment.
// ═══════════════════════════════════════════════════════════════

add_action( 'wp_ajax_lmt_mlr_save_webp', function () {
    check_ajax_referer( 'lmt_nonce', 'nonce' );
    if ( ! current_user_can( 'upload_files' ) ) wp_die( 'Forbidden', 403 );

    $id = intval( $_POST['id'] ?? 0 );
    // Validated below by a strict data-URI regex + base64_decode(); sanitizing would corrupt the payload.
    // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
    $data = isset( $_POST['data'] ) ? wp_unslash( $_POST['data'] ) : '';

    if ( ! $id || ! $data ) wp_send_json_error( 'Missing data' );
    if ( ! wp_attachment_is_image( $id ) ) wp_send_json_error( 'Not an image' );

    $src = get_attached_file( $id );
    if ( ! $src || ! file_exists( $src ) ) wp_send_json_error( 'Source file not found' );

    if ( ! preg_match( '/^data:image\/webp;base64,(.+)$/s', $data, $m ) ) {
        wp_send_json_error( 'Expected a WebP data URI' );
    }
    $raw = base64_decode( $m[1] );
    if ( ! $raw ) wp_send_json_error( 'Base64 decode failed' );

    // Build a unique .webp filename alongside the original.
    $dir      = dirname( $src );
    $basename = pathinfo( $src, PATHINFO_FILENAME );
    $filename = wp_unique_filename( $dir, $basename . '.webp' );
    $dest     = trailingslashit( $dir ) . $filename;

    if ( file_put_contents( $dest, $raw ) === false ) {
        wp_send_json_error( 'Write failed — check file permissions' );
    }

    // Register as a new attachment.
    $uploads = wp_upload_dir();
    $url     = str_replace( trailingslashit( $uploads['basedir'] ), trailingslashit( $uploads['baseurl'] ), $dest );

    $attach_id = wp_insert_attachment( [
        'guid'           => $url,
        'post_mime_type' => 'image/webp',
        'post_title'     => preg_replace( '/\.[^.]+$/', '', basename( $dest ) ),
        'post_content'   => '',
        'post_status'    => 'inherit',
    ], $dest );

    if ( is_wp_error( $attach_id ) || ! $attach_id ) {
        wp_delete_file( $dest );
        wp_send_json_error( 'Could not create attachment' );
    }

    require_once ABSPATH . 'wp-admin/includes/image.php';
    $metadata = wp_generate_attachment_metadata( $attach_id, $dest );
    wp_update_attachment_metadata( $attach_id, $metadata );

    // Carry over alt text from the original, if any.
    $alt = get_post_meta( $id, '_wp_attachment_image_alt', true );
    if ( $alt ) update_post_meta( $attach_id, '_wp_attachment_image_alt', $alt );

    wp_send_json_success( [
        'id'       => $attach_id,
        'source'   => $id,
        'filename' => basename( $dest ),
        'url'      => $url,
        'edit'     => get_edit_post_link( $attach_id, 'raw' ) ?: '',
        'width'    => $metadata['width'] ?? 0,
        'height'   => $metadata['height'] ?? 0,
        'filesize' => filesize( $dest ),
    ] );
} );

// ═══════════════════════════════════════════════════════════════
//  AJAX — MEDIA LIBRARY RESIZE: RESTORE BACKUP
// ═══════════════════════════════════════════════════════════════

add_action( 'wp_ajax_lmt_mlr_restore', function () {
    check_ajax_referer( 'lmt_nonce', 'nonce' );
    if ( ! current_user_can( 'upload_files' ) ) wp_die( 'Forbidden', 403 );

    $id   = intval( $_POST['id'] ?? 0 );
    if ( ! $id ) wp_send_json_error( 'Invalid ID' );

    $file        = get_attached_file( $id );
    $backup_path = $file . '.lmt-backup';

    if ( ! file_exists( $backup_path ) ) wp_send_json_error( 'No backup found for this image' );

    copy( $backup_path, $file );
    wp_delete_file( $backup_path );

    require_once ABSPATH . 'wp-admin/includes/image.php';
    $metadata = wp_generate_attachment_metadata( $id, $file );
    wp_update_attachment_metadata( $id, $metadata );

    wp_send_json_success( [ 'id' => $id, 'restored' => true ] );
} );


// ═══════════════════════════════════════════════════════════════
//  HELPER — call the Lookit AI platform (n8n) and return result array
//  Sends the image as a base64 data URI + prompt; n8n calls AWS Bedrock
//  (Nova Lite vision) and returns { "text": "..." }.
// ═══════════════════════════════════════════════════════════════

function lmt_n8n_call( string $endpoint, string $token, string $data_uri, string $mime, string $prompt ): array {
    $body_payload = [
        'image'  => $data_uri,   // full data URI; n8n strips the "data:...;base64," prefix
        'mime'   => $mime,
        'prompt' => $prompt,
        'site'   => [
            'url'  => get_site_url(),
            'name' => get_bloginfo( 'name' ),
        ],
    ];

    $headers = [ 'Content-Type' => 'application/json' ];
    if ( $token !== '' ) {
        $headers['Authorization'] = 'Bearer ' . $token;
    }

    $response = wp_remote_post( $endpoint, [
        'timeout' => 90,
        'headers' => $headers,
        'body'    => wp_json_encode( $body_payload ),
    ] );

    if ( is_wp_error( $response ) ) {
        return [ 'ok' => false, 'error' => $response->get_error_message() ];
    }

    $code     = wp_remote_retrieve_response_code( $response );
    $raw_body = wp_remote_retrieve_body( $response );
    $body     = json_decode( $raw_body, true );

    if ( $code !== 200 ) {
        $err = ( is_array( $body ) && isset( $body['error'] ) )
            ? ( is_string( $body['error'] ) ? $body['error'] : wp_json_encode( $body['error'] ) )
            : ( 'HTTP ' . $code . ': ' . substr( $raw_body, 0, 160 ) );
        return [ 'ok' => false, 'error' => $err ];
    }

    // n8n Respond to Webhook returns { "text": "..." }.
    // Accept a few key names defensively in case the workflow response shape changes.
    $text = '';
    if ( is_array( $body ) ) {
        $text = $body['text'] ?? $body['alt'] ?? $body['reply'] ?? $body['output'] ?? '';
    }
    if ( ! is_string( $text ) ) $text = '';

    // Strip any <think>…</think> blocks and wrapping quotes some models add.
    $text = preg_replace( '#<think>.*?</think>#is', '', $text );
    $text = trim( (string) $text );
    $text = trim( $text, "\"'" );
    $text = trim( $text );

    if ( $text === '' ) {
        $debug = substr( $raw_body, 0, 200 );
        return [ 'ok' => false, 'error' => 'Empty response from platform. Raw: ' . $debug ];
    }

    // Returned under 'alt' so both the alt-text and title handlers read one key.
    return [ 'ok' => true, 'alt' => $text ];
}

// ═══════════════════════════════════════════════════════════════
//  AJAX — TEST CONNECTION (Settings page)
//  Sends a tiny built-in image to the endpoint to confirm wiring
//  without touching the media library.
// ═══════════════════════════════════════════════════════════════

add_action( 'wp_ajax_lmt_ai_test', function () {
    check_ajax_referer( 'lmt_nonce', 'nonce' );
    if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Forbidden', 403 );

    $endpoint = get_option( 'lmt_n8n_endpoint', '' );
    if ( ! $endpoint ) wp_send_json_error( 'No endpoint set. Save your Lookit AI endpoint first.' );
    $token = get_option( 'lmt_n8n_token', '' );

    // Small built-in 8x8 PNG — enough to exercise the full round-trip.
    $png_b64  = 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR42mPQqDiBFTEMLQkAAtVaAbl+5LMAAAAASUVORK5CYII=';
    $data_uri = 'data:image/png;base64,' . $png_b64;
    $prompt   = 'This is a connection test. Reply with just the two letters: OK';

    $t0     = microtime( true );
    $result = lmt_n8n_call( $endpoint, $token, $data_uri, 'image/png', $prompt );
    $ms     = (int) round( ( microtime( true ) - $t0 ) * 1000 );

    if ( $result['ok'] ) {
        wp_send_json_success( [
            'reply' => $result['alt'],
            'ms'    => $ms,
        ] );
    }
    wp_send_json_error( $result['error'] );
} );

// ═══════════════════════════════════════════════════════════════
//  Posts the image + prompt to the platform (n8n), which calls
//  AWS Bedrock (Nova Lite vision) and returns the text.
// ═══════════════════════════════════════════════════════════════

add_action( 'wp_ajax_lmt_ai_alt_generate', function () {
    check_ajax_referer( 'lmt_nonce', 'nonce' );
    if ( ! current_user_can( 'upload_files' ) ) wp_die( 'Forbidden', 403 );

    $id = intval( $_POST['id'] ?? 0 );
    if ( ! $id ) wp_send_json_error( 'Invalid ID' );

    $endpoint = get_option( 'lmt_n8n_endpoint', '' );
    if ( ! $endpoint ) wp_send_json_error( 'No Lookit AI endpoint set. Go to Media Master → Settings.' );
    $token = get_option( 'lmt_n8n_token', '' );

    $prompt = get_option( 'lmt_ai_prompt', 'Write a concise, descriptive alt text for this image. Be specific about what is shown. Keep it under 125 characters. Do not start with "Image of" or "Photo of". Return only the alt text, nothing else.' );

    // Read image from disk — use medium thumbnail for large files (saves cost)
    $file = get_attached_file( $id );
    if ( ! $file || ! file_exists( $file ) ) wp_send_json_error( 'Image file not found on disk' );

    if ( filesize( $file ) > 4 * 1024 * 1024 ) {
        $upload_dir = wp_upload_dir();
        $thumb_url  = wp_get_attachment_image_url( $id, 'medium' );
        if ( $thumb_url ) {
            $rel = str_replace( $upload_dir['baseurl'], $upload_dir['basedir'], $thumb_url );
            if ( file_exists( $rel ) ) $file = $rel;
        }
    }

    if ( filesize( $file ) > 10 * 1024 * 1024 ) {
        wp_send_json_error( 'Image too large (>10 MB even after thumbnail fallback).' );
    }

    $mime          = mime_content_type( $file ) ?: get_post_mime_type( $id );
    $allowed_mimes = [ 'image/jpeg', 'image/png', 'image/gif', 'image/webp' ];
    if ( ! in_array( $mime, $allowed_mimes, true ) ) {
        wp_send_json_error( 'Unsupported image type: ' . $mime );
    }

    $raw = file_get_contents( $file );
    if ( ! $raw ) wp_send_json_error( 'Could not read image file' );
    $data_uri = 'data:' . $mime . ';base64,' . base64_encode( $raw );

    $result = lmt_n8n_call( $endpoint, $token, $data_uri, $mime, $prompt );
    if ( $result['ok'] ) {
        $alt  = $result['alt'];
        $save = ( sanitize_text_field( wp_unslash( $_POST['save'] ?? '0' ) ) === '1' );
        if ( $save ) {
            update_post_meta( $id, '_wp_attachment_image_alt', sanitize_text_field( $alt ) );
        }
        wp_send_json_success( [
            'id'    => $id,
            'alt'   => $alt,
            'saved' => $save,
        ] );
        return;
    }

    wp_send_json_error( 'AI generation failed: ' . $result['error'] );
} );

// ═══════════════════════════════════════════════════════════════
//  ADMIN PAGE
// ═══════════════════════════════════════════════════════════════

function lmt_render_page() {
    $logo_url = LMT_PLUGIN_URL . 'assets/logo.png';
    ?>
    <div class="wrap lmt-admin-page">
    <div class="lmt-wrap" id="lmt-root">

      <!-- ── Top bar ── -->
      <div class="lmt-topbar">
        <div class="lmt-topbar-brand">
          <div class="lmt-logo-wrap">
            <img src="<?php echo esc_url( $logo_url ); ?>" alt="Lookit Design" />
          </div>
          <div>
            <div class="lmt-topbar-title">Lookit Media Master</div>
            <div class="lmt-topbar-sub">
              <span class="lmt-status-dot"></span>
              All tools run securely within your WordPress admin
            </div>
          </div>
        </div>
        <div class="lmt-topbar-meta">
          <span class="lmt-version-badge">v3.16 · AWS Bedrock AI</span>
          <button class="lmt-theme-toggle" id="lmt-theme-toggle" title="Toggle light / dark mode">
            <!-- Sun icon: shown in dark mode -->
            <span class="lmt-icon-sun">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            </span>
            <!-- Moon icon: shown in light mode -->
            <span class="lmt-icon-moon">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </span>
            <span class="lmt-theme-label-dark">Light Mode</span>
            <span class="lmt-theme-label-light">Dark Mode</span>
          </button>
          <button class="lmt-theme-toggle lmt-corners-toggle" id="lmt-corners-toggle" title="Toggle square / rounded corners">
            <span class="lmt-corners-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/></svg>
            </span>
            <span id="lmt-corners-label">Square Corners</span>
          </button>
        </div>
      </div>
      <div class="lmt-tabnav">
        <button class="lmt-tab active" data-tab="mlr">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          Image Resizer
          <span class="lmt-tab-sub">Upload &amp; compress · resize in-place</span>
        </button>
        <button class="lmt-tab" data-tab="alt">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Alt Text Manager
          <span class="lmt-tab-sub">Bulk edit &amp; backfill</span>
        </button>
        <button class="lmt-tab" data-tab="title">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
          Title Manager
          <span class="lmt-tab-sub">Edit titles · AI generate</span>
        </button>
      </div>

      <!-- ══════════════════════════════════════════
           TAB 1 — IMAGE RESIZER  (combined: upload + library resize)
           Two sub-views inside one panel:
             • #lmt-library-view  — browse & resize existing media (default)
             • #lmt-upload-view   — upload & compress new images (toggle)
      ══════════════════════════════════════════ -->
      <div class="lmt-panel active" id="lmt-panel-mlr">
        <div class="lmt-panel-inner">

          <!-- ── UPLOAD VIEW (shown when "Upload Images" is clicked) ── -->
          <div class="lmt-subview" id="lmt-upload-view" style="display:none">

          <div class="lmt-action-bar" style="margin-bottom:14px;">
            <button type="button" class="lmt-btn" id="lkir-back-btn">&#8592; Back to Library</button>
            <span class="lmt-status-text" style="margin-left:0;color:var(--text-2)">Upload &amp; compress new images — nothing is sent to the server until you click upload.</span>
          </div>

          <!-- Drop zone -->
          <div class="lmt-section lmt-dropzone-section">
            <div class="lmt-section-head">
              <span class="lmt-section-title">Upload Images</span>
              <span class="lmt-section-desc">Drop files or click to browse — nothing is sent to the server</span>
            </div>
            <div class="lmt-dropzone" id="lkir-drop">
              <div class="lmt-drop-icon-ring">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </div>
              <p class="lmt-drop-title"><span>Click to browse</span> or drag &amp; drop images here</p>
              <p class="lmt-drop-note" id="lkir-filename">JPG &nbsp;·&nbsp; PNG &nbsp;·&nbsp; WebP &nbsp;·&nbsp; BMP &nbsp;·&nbsp; TIFF &nbsp;—&nbsp; single or batch</p>
              <p class="lmt-filelist" id="lkir-filelist"></p>
              <input id="lkir-input" type="file" accept="image/*" multiple />
            </div>
          </div>

          <!-- Controls row -->
          <div class="lmt-controls-row">

            <!-- Resize -->
            <div class="lmt-section lmt-section-panel">
              <div class="lmt-section-head">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                <span class="lmt-section-title">Resize — Longest Edge</span>
              </div>
              <div class="lmt-section-body">
                <div class="lmt-radio-group">
                  <label><input type="radio" name="lkir_size" value="2400"> <span>2400px</span> <em>Large · hero / slider</em></label>
                  <label><input type="radio" name="lkir_size" value="1200" checked> <span>1200px</span> <em>Standard · default</em></label>
                  <label><input type="radio" name="lkir_size" value="800"> <span>800px</span> <em>Medium · blog</em></label>
                  <label><input type="radio" name="lkir_size" value="600"> <span>600px</span> <em>Small · inline / grid</em></label>
                  <label class="lmt-custom-row">
                    <input type="radio" name="lkir_size" value="custom"> <span>Custom</span> <em>px</em>
                    <input type="number" id="lkir-custom-px" min="16" max="8000" placeholder="e.g. 1400" class="lmt-custom-input" />
                  </label>
                </div>
              </div>
            </div>

            <!-- Format & Compression -->
            <div class="lmt-section lmt-section-panel">
              <div class="lmt-section-head">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                <span class="lmt-section-title">Output &amp; Compression</span>
              </div>
              <div class="lmt-section-body">
                <label class="lmt-label">Format</label>
                <select id="lkir-format" class="lmt-select">
                  <option value="JPEG" selected>JPEG</option>
                  <option value="WEBP">WebP — smaller file</option>
                  <option value="PNG">PNG — lossless</option>
                </select>
                <label class="lmt-label">Quality: <strong id="lkir-quality-val">82</strong></label>
                <div class="lmt-quality-row">
                  <input type="range" id="lkir-quality" min="10" max="100" value="82" step="1" class="lmt-range" />
                  <span class="lmt-quality-bubble" id="lkir-quality-bubble">82</span>
                </div>
                <p class="lmt-note" id="lkir-quality-note">Lower = smaller file. Recommended: 75–90.</p>
                <label class="lmt-label" style="margin-top:14px;">Rename Output</label>
                <input id="lkir-rename" type="text" placeholder="e.g. product-hero" class="lmt-text-input" />
                <p class="lmt-note">Leave blank to keep original filename.</p>
              </div>
            </div>

          </div><!-- .lmt-controls-row -->

          <!-- Action bar -->
          <div class="lmt-action-bar">
            <button type="button" class="lmt-btn" id="lkir-btn-preview">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              Update Preview
            </button>
            <button type="button" class="lmt-btn" id="lkir-btn-upload">&#8593; Upload to Media Library</button>
            <button type="button" class="lmt-btn lmt-btn-primary" id="lkir-btn-download">&#11015; Download</button>
            <button type="button" class="lmt-btn lmt-btn-primary" id="lkir-btn-zip">&#11015; Download ZIP (Batch)</button>
            <span class="lmt-status-text" id="lkir-status"></span>
          </div>

          <!-- Preview -->
          <div class="lmt-preview-area" id="lkir-preview-wrap">
            <img id="lkir-preview-img" class="lmt-preview-img lmt-hidden" alt="Preview" />
            <div class="lmt-meta-bar lmt-hidden" id="lkir-meta"></div>
          </div>

          </div><!-- #lmt-upload-view -->

          <!-- ── LIBRARY VIEW (default — browse & resize existing media) ── -->
          <div class="lmt-subview" id="lmt-library-view">

          <!-- Warning banner (dismissible; also shown permanently in Settings) -->
          <div class="lmt-alert lmt-alert-warn" id="lmt-resize-warn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div>
              <strong>This overwrites files on your server.</strong>
              URLs stay the same but the original high-res file is replaced. Enable "Create backup" below to keep a copy before resizing. Backups can be restored one-by-one.
            </div>
            <button type="button" class="lmt-alert-dismiss" id="lmt-resize-warn-x" title="Dismiss this notice" aria-label="Dismiss">&times;</button>
          </div>

          <!-- Controls row -->
          <div class="lmt-controls-row" style="margin-top:0;">

            <!-- Resize settings -->
            <div class="lmt-section lmt-section-panel">
              <div class="lmt-section-head">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                <span class="lmt-section-title">Resize Settings</span>
              </div>
              <div class="lmt-section-body">
                <div class="lmt-radio-group">
                  <label><input type="radio" name="mlr_size" value="2560"> <span>2560px</span> <em>Max</em></label>
                  <label><input type="radio" name="mlr_size" value="2400"> <span>2400px</span> <em>Large · hero</em></label>
                  <label><input type="radio" name="mlr_size" value="1200" checked> <span>1200px</span> <em>Standard</em></label>
                  <label><input type="radio" name="mlr_size" value="800"> <span>800px</span> <em>Medium</em></label>
                  <label><input type="radio" name="mlr_size" value="600"> <span>600px</span> <em>Small</em></label>
                  <label class="lmt-custom-row">
                    <input type="radio" name="mlr_size" value="custom"> <span>Custom</span>
                    <input type="number" id="mlr-custom-px" min="16" max="8000" placeholder="px" class="lmt-custom-input" />
                  </label>

                  <!-- Saved custom sizes (named, reorderable — stored per browser) -->
                  <div class="lmt-saved-sizes" id="mlr-saved-sizes"></div>
                </div>

                <div class="lmt-saved-add">
                  <input type="text" id="mlr-saved-name" class="lmt-text-input" placeholder="Name (e.g. Blog hero)" maxlength="40" />
                  <input type="number" id="mlr-saved-px" class="lmt-text-input lmt-saved-px" min="16" max="8000" placeholder="px" />
                  <button type="button" class="lmt-btn lmt-btn-sm" id="mlr-saved-add-btn">+ Save size</button>
                </div>
                <p class="lmt-note">Saved sizes are stored in this browser. Drag the ⠿ handle to reorder.</p>
              </div>
            </div>

            <!-- Options -->
            <div class="lmt-section lmt-section-panel">
              <div class="lmt-section-head">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>
                <span class="lmt-section-title">Options</span>
              </div>
              <div class="lmt-section-body">
                <label class="lmt-label">Output</label>
                <select id="mlr-output-fmt" class="lmt-select">
                  <option value="keep">Keep original format (resize in place)</option>
                  <option value="webp">Convert to WebP (adds a new copy)</option>
                </select>
                <p class="lmt-note" id="mlr-output-note">Resizes and overwrites the original file. URLs stay the same.</p>

                <label class="lmt-label" style="margin-top:14px;">JPEG / WebP Quality: <strong id="mlr-quality-val">82</strong></label>
                <div class="lmt-quality-row">
                  <input type="range" id="mlr-quality" min="10" max="100" value="82" step="1" class="lmt-range" />
                  <span class="lmt-quality-bubble" id="mlr-quality-bubble">82</span>
                </div>
                <p class="lmt-note">Applies to JPEG &amp; WebP output. PNG files stay lossless.</p>

                <label class="lmt-label" style="margin-top:14px;">Filter</label>
                <select id="mlr-filter" class="lmt-select">
                  <option value="all">All images</option>
                  <option value="large">Large images only (&gt;1200px)</option>
                </select>

                <label class="lmt-toggle-row" style="margin-top:14px;" id="mlr-backup-row">
                  <input type="checkbox" id="mlr-backup" checked />
                  <span>Create backup before overwriting</span>
                </label>
                <p class="lmt-note" id="mlr-backup-note">Backs up the original file once (can be restored per image).</p>
              </div>
            </div>

          </div>

          <!-- Search + action bar -->
          <div class="lmt-action-bar">
            <input type="text" id="mlr-search" placeholder="Search by filename…" class="lmt-text-input lmt-search-input" />
            <button type="button" class="lmt-btn" id="mlr-btn-load">Load Images</button>
            <button type="button" class="lmt-btn" id="mlr-btn-upload-view">&#8593; Upload Images</button>
            <button type="button" class="lmt-btn lmt-btn-primary" id="mlr-btn-bulk" disabled>&#9654; Resize Selected</button>
            <span class="lmt-resize-summary" id="mlr-resize-summary"></span>
            <button type="button" class="lmt-btn lmt-btn-danger" id="mlr-btn-stop" style="display:none">&#9632; Stop</button>
            <label class="lmt-toggle-row" style="margin-left:auto;">
              <input type="checkbox" id="mlr-select-all" />
              <span>Select all</span>
            </label>
            <span class="lmt-status-text" id="mlr-status"></span>
          </div>

          <!-- View controls: grid/list toggle · size slider · per-page -->
          <div class="lmt-view-bar">
            <div class="lmt-view-toggle" role="group" aria-label="View mode">
              <button type="button" class="lmt-view-btn active" id="mlr-view-grid" data-view="grid" title="Grid view">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </button>
              <button type="button" class="lmt-view-btn" id="mlr-view-list" data-view="list" title="List view">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
            </div>
            <div class="lmt-size-control" title="Display size">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
              <input type="range" id="mlr-size" class="lmt-range lmt-size-range" min="140" max="360" value="200" step="20" />
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/></svg>
            </div>
            <label class="lmt-view-perpage">
              <span>Sort</span>
              <select id="mlr-sort" class="lmt-select lmt-select-sm">
                <option value="date_desc" selected>Newest first</option>
                <option value="date_asc">Oldest first</option>
                <option value="name_asc">Filename A–Z</option>
                <option value="name_desc">Filename Z–A</option>
              </select>
            </label>
            <label class="lmt-view-perpage">
              <span>Type</span>
              <select id="mlr-type" class="lmt-select lmt-select-sm">
                <option value="all" selected>All types</option>
                <option value="jpg">JPG</option>
                <option value="png">PNG</option>
                <option value="webp">WebP</option>
              </select>
            </label>
            <div class="lmt-view-spacer"></div>
            <label class="lmt-view-perpage">
              <span>Show</span>
              <select id="mlr-perpage" class="lmt-select lmt-select-sm">
                <option value="30" selected>30</option>
                <option value="60">60</option>
                <option value="100">100</option>
                <option value="all">All</option>
              </select>
              <span>per page</span>
            </label>
          </div>

          <!-- Progress -->
          <div class="lmt-progress-wrap lmt-hidden" id="mlr-progress-wrap">
            <div class="lmt-progress-head">
              <span id="mlr-progress-label">Processing…</span>
              <span id="mlr-progress-pct">0%</span>
            </div>
            <div class="lmt-progress-track"><div class="lmt-progress-fill" id="mlr-progress-fill"></div></div>
            <div class="lmt-progress-sub" id="mlr-progress-count"></div>
          </div>

          <!-- Image grid -->
          <div id="mlr-grid-wrap" class="lmt-image-grid-wrap">
            <div class="lmt-grid-empty">Click "Load Images" to browse your media library, or "Upload Images" to add new ones.</div>
          </div>
          <div class="lmt-loadmore" id="mlr-loadmore"></div>
          <div class="lmt-pagination" id="mlr-pagination"></div>

          </div><!-- #lmt-library-view -->

        </div>
      </div><!-- #lmt-panel-mlr -->

      <!-- ══════════════════════════════════════════
           TAB 3 — ALT TEXT MANAGER
      ══════════════════════════════════════════ -->
      <div class="lmt-panel" id="lmt-panel-alt">
        <div class="lmt-panel-inner">

          <!-- Stats row -->
          <div class="lmt-stats-row" id="lmt-alt-stats">
            <div class="lmt-stat-card lmt-stat-clickable" onclick="window.lmtAltFilter('all')" title="Show all images">
              <strong id="alt-stat-total">—</strong>
              <span>Total Images</span>
            </div>
            <div class="lmt-stat-card lmt-stat-green lmt-stat-clickable" onclick="window.lmtAltFilter('has')" title="Show only images that have alt text">
              <strong id="alt-stat-has">—</strong>
              <span>Have Alt Text</span>
              <div class="lmt-stat-bar-wrap"><div class="lmt-stat-bar lmt-stat-bar-green" id="alt-bar-has" style="width:0%"></div></div>
            </div>
            <div class="lmt-stat-card lmt-stat-red lmt-stat-clickable" onclick="window.lmtAltFilter('missing')" title="Show only images missing alt text">
              <strong id="alt-stat-missing">—</strong>
              <span>Missing Alt Text</span>
              <div class="lmt-stat-bar-wrap"><div class="lmt-stat-bar lmt-stat-bar-red" id="alt-bar-missing" style="width:0%"></div></div>
            </div>
          </div>

          <!-- AI banner -->
          <div class="lmt-ai-banner" id="lmt-ai-banner">
            <div class="lmt-ai-banner-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 8v4l3 3"/><path d="M18 2l4 4-4 4"/><path d="M22 2l-4 4"/></svg>
            </div>
            <div class="lmt-ai-banner-text">
              <strong>AI Alt Text via AWS Bedrock (Nova Lite Vision)</strong>
              <span id="lmt-ai-status-msg">Checking API key…</span>
            </div>
            <a href="<?php echo esc_url( admin_url('admin.php?page=lookit-media-master-settings') ); ?>" class="lmt-btn lmt-btn-sm" id="lmt-ai-settings-link">⚙ Settings</a>
          </div>

          <!-- Toolbar -->
          <div class="lmt-action-bar">
            <input type="text" id="alt-search" placeholder="Search by filename…" class="lmt-text-input lmt-search-input" />
            <select id="alt-filter" class="lmt-select lmt-select-sm">
              <option value="all">All images</option>
              <option value="has">Have alt only</option>
              <option value="missing">Missing alt only</option>
            </select>
            <button class="lmt-btn" id="alt-refresh-btn">↺ Refresh</button>
            <button type="button" class="lmt-filter-chip" id="alt-chip-missing" title="Select all loaded images that are missing alt text, and jump to the first">⚠ Select missing alt</button>
            <label class="lmt-toggle-row">
              <input type="checkbox" id="alt-select-all">
              <span>Select all on page</span>
            </label>
            <div style="flex:1"></div>
            <label class="lmt-toggle-row">
              <input type="checkbox" id="alt-overwrite">
              <span>Overwrite existing</span>
            </label>
            <button class="lmt-btn" id="alt-title-bulk-btn" title="Use each image's title as its alt text for all selected images" disabled>&#128221; Use Title as Alt (Selected)</button>
            <button class="lmt-btn lmt-btn-primary" id="alt-save-bulk-btn" title="Save the current alt text field for every selected image" disabled>&#128190; Save (Selected)</button>
            <button class="lmt-btn lmt-btn-ai" id="alt-ai-bulk-btn" disabled>&#10024; AI Generate (Selected)</button>
            <button class="lmt-btn lmt-btn-danger" id="alt-stop-btn" style="display:none">&#9632; Stop</button>
          </div>

          <!-- View controls: grid/list toggle · size slider · per-page -->
          <div class="lmt-view-bar">
            <div class="lmt-view-toggle" role="group" aria-label="View mode">
              <button type="button" class="lmt-view-btn active" id="alt-view-grid" data-view="grid" title="Grid view">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </button>
              <button type="button" class="lmt-view-btn" id="alt-view-list" data-view="list" title="List view">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
            </div>
            <div class="lmt-size-control" title="Display size">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
              <input type="range" id="alt-size" class="lmt-range lmt-size-range" min="140" max="360" value="200" step="20" />
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/></svg>
            </div>
            <label class="lmt-view-perpage">
              <span>Sort</span>
              <select id="alt-sort" class="lmt-select lmt-select-sm">
                <option value="date_desc" selected>Newest first</option>
                <option value="date_asc">Oldest first</option>
                <option value="name_asc">Filename A–Z</option>
                <option value="name_desc">Filename Z–A</option>
              </select>
            </label>
            <label class="lmt-view-perpage">
              <span>Type</span>
              <select id="alt-type" class="lmt-select lmt-select-sm">
                <option value="all" selected>All types</option>
                <option value="jpg">JPG</option>
                <option value="png">PNG</option>
                <option value="webp">WebP</option>
              </select>
            </label>
            <div class="lmt-view-spacer"></div>
            <label class="lmt-view-perpage">
              <span>Show</span>
              <select id="alt-perpage" class="lmt-select lmt-select-sm">
                <option value="30" selected>30</option>
                <option value="60">60</option>
                <option value="100">100</option>
                <option value="all">All</option>
              </select>
              <span>per page</span>
            </label>
          </div>

          <!-- Progress -->
          <div class="lmt-progress-wrap lmt-hidden" id="alt-progress-wrap">
            <div class="lmt-progress-head">
              <span id="alt-progress-label">Processing…</span>
              <span id="alt-progress-pct">0%</span>
            </div>
            <div class="lmt-progress-track"><div class="lmt-progress-fill" id="alt-progress-fill"></div></div>
            <div class="lmt-progress-sub" id="alt-progress-count"></div>
            <div class="lmt-log" id="alt-log"></div>
          </div>

          <!-- Grid -->
          <div id="alt-grid-wrap" class="lmt-image-grid-wrap">
            <div class="lmt-grid-empty">Loading images…</div>
          </div>
          <div class="lmt-loadmore" id="alt-loadmore"></div>
          <div class="lmt-pagination" id="alt-pagination"></div>

        </div>
      </div><!-- #lmt-panel-alt -->

      <!-- ══════════════════════════════════════════
           TAB 4 — TITLE MANAGER
           Same UX as Alt Manager but edits post_title.
           "Auto" = WordPress's default filename-as-title.
           "Custom" = anything human-edited.
      ══════════════════════════════════════════ -->
      <div class="lmt-panel" id="lmt-panel-title">
        <div class="lmt-panel-inner">

          <!-- Stats row -->
          <div class="lmt-stats-row" id="lmt-title-stats">
            <div class="lmt-stat-card lmt-stat-clickable" onclick="window.lmtTitleFilter('all')" title="Show all images">
              <strong id="title-stat-total">—</strong>
              <span>Total Images</span>
            </div>
            <div class="lmt-stat-card lmt-stat-green lmt-stat-clickable" onclick="window.lmtTitleFilter('custom')" title="Show only images with a custom title">
              <strong id="title-stat-custom">—</strong>
              <span>Custom Titles</span>
              <div class="lmt-stat-bar-wrap"><div class="lmt-stat-bar lmt-stat-bar-green" id="title-bar-custom" style="width:0%"></div></div>
            </div>
            <div class="lmt-stat-card lmt-stat-red lmt-stat-clickable" onclick="window.lmtTitleFilter('auto')" title="Show only images with an auto (filename) title">
              <strong id="title-stat-auto">—</strong>
              <span>Auto (Filename) Titles</span>
              <div class="lmt-stat-bar-wrap"><div class="lmt-stat-bar lmt-stat-bar-red" id="title-bar-auto" style="width:0%"></div></div>
            </div>
          </div>

          <!-- AI banner -->
          <div class="lmt-ai-banner" id="lmt-ai-banner-title">
            <div class="lmt-ai-banner-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 8v4l3 3"/><path d="M18 2l4 4-4 4"/><path d="M22 2l-4 4"/></svg>
            </div>
            <div class="lmt-ai-banner-text">
              <strong>AI Image Titles via AWS Bedrock (Nova Lite Vision)</strong>
              <span id="lmt-ai-status-msg-title">Checking API key…</span>
            </div>
            <a href="<?php echo esc_url( admin_url('admin.php?page=lookit-media-master-settings') ); ?>" class="lmt-btn lmt-btn-sm">⚙ Settings</a>
          </div>

          <!-- Toolbar -->
          <div class="lmt-action-bar">
            <input type="text" id="title-search" placeholder="Search by filename…" class="lmt-text-input lmt-search-input" />
            <select id="title-filter" class="lmt-select lmt-select-sm">
              <option value="all">All images</option>
              <option value="custom">Custom titles only</option>
              <option value="auto">Auto titles only</option>
            </select>
            <button class="lmt-btn" id="title-refresh-btn">↺ Refresh</button>
            <button type="button" class="lmt-filter-chip" id="title-chip-auto" title="Select all loaded images that still have an auto (filename) title, and jump to the first">⚠ Select auto titles</button>
            <label class="lmt-toggle-row">
              <input type="checkbox" id="title-select-all">
              <span>Select all on page</span>
            </label>
            <div style="flex:1"></div>
            <label class="lmt-toggle-row">
              <input type="checkbox" id="title-overwrite">
              <span>Overwrite custom titles</span>
            </label>
            <button class="lmt-btn" id="title-filename-bulk-btn" title="Use the filename (with dashes/underscores replaced by spaces) as the title for all selected images" disabled>&#128221; Auto-Title from Filename (Selected)</button>
            <button class="lmt-btn lmt-btn-primary" id="title-save-bulk-btn" title="Save the current title field for every selected image" disabled>&#128190; Save (Selected)</button>
            <button class="lmt-btn lmt-btn-ai" id="title-ai-bulk-btn" disabled>&#10024; AI Generate (Selected)</button>
            <button class="lmt-btn lmt-btn-danger" id="title-stop-btn" style="display:none">&#9632; Stop</button>
          </div>

          <!-- View controls: grid/list toggle · size slider · per-page -->
          <div class="lmt-view-bar">
            <div class="lmt-view-toggle" role="group" aria-label="View mode">
              <button type="button" class="lmt-view-btn active" id="title-view-grid" data-view="grid" title="Grid view">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </button>
              <button type="button" class="lmt-view-btn" id="title-view-list" data-view="list" title="List view">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
            </div>
            <div class="lmt-size-control" title="Display size">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
              <input type="range" id="title-size" class="lmt-range lmt-size-range" min="140" max="360" value="200" step="20" />
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/></svg>
            </div>
            <label class="lmt-view-perpage">
              <span>Sort</span>
              <select id="title-sort" class="lmt-select lmt-select-sm">
                <option value="date_desc" selected>Newest first</option>
                <option value="date_asc">Oldest first</option>
                <option value="name_asc">Filename A–Z</option>
                <option value="name_desc">Filename Z–A</option>
              </select>
            </label>
            <label class="lmt-view-perpage">
              <span>Type</span>
              <select id="title-type" class="lmt-select lmt-select-sm">
                <option value="all" selected>All types</option>
                <option value="jpg">JPG</option>
                <option value="png">PNG</option>
                <option value="webp">WebP</option>
              </select>
            </label>
            <div class="lmt-view-spacer"></div>
            <label class="lmt-view-perpage">
              <span>Show</span>
              <select id="title-perpage" class="lmt-select lmt-select-sm">
                <option value="30" selected>30</option>
                <option value="60">60</option>
                <option value="100">100</option>
                <option value="all">All</option>
              </select>
              <span>per page</span>
            </label>
          </div>

          <!-- Progress -->
          <div class="lmt-progress-wrap lmt-hidden" id="title-progress-wrap">
            <div class="lmt-progress-head">
              <span id="title-progress-label">Processing…</span>
              <span id="title-progress-pct">0%</span>
            </div>
            <div class="lmt-progress-track"><div class="lmt-progress-fill" id="title-progress-fill"></div></div>
            <div class="lmt-progress-sub" id="title-progress-count"></div>
            <div class="lmt-log" id="title-log"></div>
          </div>

          <!-- Grid -->
          <div id="title-grid-wrap" class="lmt-image-grid-wrap">
            <div class="lmt-grid-empty">Loading images…</div>
          </div>
          <div class="lmt-loadmore" id="title-loadmore"></div>
          <div class="lmt-pagination" id="title-pagination"></div>

        </div>
      </div><!-- #lmt-panel-title -->

    </div><!-- .lmt-wrap -->
    </div><!-- .wrap -->
    <?php
}
