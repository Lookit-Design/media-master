<?php
/**
 * @package Lookit_Media_Master
 */

class Test_Lookit_Media_Master_Uninstall extends WP_UnitTestCase {

	public function test_uninstall_deletes_plugin_options() {
		update_option( 'lmt_n8n_endpoint', 'lookit-test-value' );

		if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
			define( 'WP_UNINSTALL_PLUGIN', 'lookit-media-master/lookit-media-master.php' );
		}
		require dirname( __DIR__ ) . '/uninstall.php';

		$this->assertFalse( get_option( 'lmt_n8n_endpoint' ) );
	}
}
