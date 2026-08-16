<?php
/**
 * @package Lookit_Media_Master
 */

class Test_Lookit_Media_Master_Plugin extends WP_UnitTestCase {

	public function test_plugin_defines_version() {
		$this->assertTrue( defined( 'LMT_VERSION' ) );
	}
}
