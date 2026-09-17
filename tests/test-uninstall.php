<?php
/**
 * @package Lookit_Media_Master
 */

class Test_Lookit_Media_Master_Uninstall extends WP_UnitTestCase {

	public function test_uninstall_deletes_plugin_options() {
		global $wp_filesystem;

		update_option( 'lmt_n8n_endpoint', 'lookit-test-value' );
		update_option( 'lmt_n8n_token', 'secret' );
		update_option( 'lmt_ai_prompt', 'prompt' );
		update_option( 'lmt_ai_title_prompt', 'title prompt' );
		update_option( 'lmt_ai_caption_prompt', 'caption prompt' );
		update_option( 'lmt_ai_desc_prompt', 'description prompt' );
		update_option( 'lmt_absorb_media_menu', '1' );
		update_option( 'lmt_openrouter_api_key', 'retired-secret' );
		update_option( 'lmt_openrouter_model', 'retired-model' );
		wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', 'lmt_export_cleanup_event' );

		require_once ABSPATH . 'wp-admin/includes/file.php';
		WP_Filesystem();
		$uploads = wp_upload_dir();
		$exports = trailingslashit( $uploads['basedir'] ) . 'lookit-media-master-exports';
		wp_mkdir_p( $exports . '/' . str_repeat( 'e', 48 ) );
		$wp_filesystem->put_contents( $exports . '/' . str_repeat( 'e', 48 ) . '/archive.zip', 'fixture' );

		if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
			define( 'WP_UNINSTALL_PLUGIN', 'lookit-media-master/lookit-media-master.php' );
		}
		require dirname( __DIR__ ) . '/uninstall.php';

		$this->assertFalse( get_option( 'lmt_n8n_endpoint' ) );
		$this->assertFalse( get_option( 'lmt_n8n_token' ) );
		$this->assertFalse( get_option( 'lmt_ai_prompt' ) );
		$this->assertFalse( get_option( 'lmt_ai_title_prompt' ) );
		$this->assertFalse( get_option( 'lmt_ai_caption_prompt' ) );
		$this->assertFalse( get_option( 'lmt_ai_desc_prompt' ) );
		$this->assertFalse( get_option( 'lmt_absorb_media_menu' ) );
		$this->assertFalse( get_option( 'lmt_openrouter_api_key' ) );
		$this->assertFalse( get_option( 'lmt_openrouter_model' ) );
		$this->assertFalse( wp_next_scheduled( 'lmt_export_cleanup_event' ) );
		$this->assertDirectoryDoesNotExist( $exports );
	}
}
