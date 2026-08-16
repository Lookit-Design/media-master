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
);

if ( is_multisite() ) {
	foreach ( get_sites( array( 'fields' => 'ids' ) ) as $lmt_uninstall_site_id ) {
		switch_to_blog( $lmt_uninstall_site_id );
		foreach ( $lmt_uninstall_options as $lmt_uninstall_option ) {
			delete_option( $lmt_uninstall_option );
		}
		restore_current_blog();
	}
} else {
	foreach ( $lmt_uninstall_options as $lmt_uninstall_option ) {
		delete_option( $lmt_uninstall_option );
	}
}
