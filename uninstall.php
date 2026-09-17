<?php
/**
 * Uninstall routine for Lookit Media Master.
 *
 * @package Lookit_Media_Master
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

$lmt_uninstall_options = array(
	'lmt_n8n_endpoint',
	'lmt_n8n_token',
	'lmt_ai_prompt',
	'lmt_ai_title_prompt',
	'lmt_ai_caption_prompt',
	'lmt_ai_desc_prompt',
	'lmt_absorb_media_menu',
	'lmt_title_cache_generation',
	'lmt_metadata_cache_generation',
	'lmt_usage_cache_generation',
	'lmt_openrouter_api_key',
	'lmt_openrouter_model',
	'lmt_api_key',
	'lmt_ai_model',
);

function lmt_uninstall_site_data( $lmt_uninstall_options ) {
	foreach ( $lmt_uninstall_options as $lmt_uninstall_option ) {
		delete_option( $lmt_uninstall_option );
	}

	wp_clear_scheduled_hook( 'lmt_export_cleanup_event' );

	$lmt_uploads    = wp_upload_dir();
	$lmt_export_dir = trailingslashit( $lmt_uploads['basedir'] ) . 'lookit-media-master-exports';
	if ( ! is_dir( $lmt_export_dir ) ) {
		return;
	}

	global $wp_filesystem;
	require_once ABSPATH . 'wp-admin/includes/file.php';
	if ( WP_Filesystem() && $wp_filesystem ) {
		$wp_filesystem->delete( $lmt_export_dir, true );
	}
}

if ( is_multisite() ) {
	foreach ( get_sites( array( 'fields' => 'ids' ) ) as $lmt_uninstall_site_id ) {
		switch_to_blog( $lmt_uninstall_site_id );
		lmt_uninstall_site_data( $lmt_uninstall_options );
		restore_current_blog();
	}
} else {
	lmt_uninstall_site_data( $lmt_uninstall_options );
}
