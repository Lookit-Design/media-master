<?php
/**
 * @package Lookit_Media_Master
 */

class Test_Lookit_Media_Master_Plugin extends WP_UnitTestCase {

	public function test_plugin_defines_version() {
		$this->assertTrue( defined( 'LMT_VERSION' ) );
		$this->assertSame( '3.27.1', LMT_VERSION );
	}

	public function test_import_capabilities_report_wordpress_upload_limit() {
		$capabilities = lmt_import_capabilities();

		$this->assertSame( wp_max_upload_size(), $capabilities['max_upload'] );
		$this->assertNotSame( '', $capabilities['max_upload_h'] );
	}
}
