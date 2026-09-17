<?php
/**
 * @package Lookit_Media_Master
 */

class Test_Lookit_Media_Master_Assets extends WP_UnitTestCase {

	private function asset_contents( $name ) {
		global $wp_filesystem;

		require_once ABSPATH . 'wp-admin/includes/file.php';
		WP_Filesystem();
		return $wp_filesystem->get_contents( dirname( __DIR__ ) . '/assets/' . $name );
	}

	public function test_app_uses_shared_card_size_and_page_memory_preferences() {
		$script = $this->asset_contents( 'app.js' );

		$this->assertStringContainsString( "const LMT_SIZE_KEY = 'lmt_size'", $script );
		$this->assertStringContainsString( "const PAGE_KEY   = 'lmt_page_'", $script );
		$this->assertStringContainsString( "const REMEMBER_K = 'lmt_remember_page'", $script );
		$this->assertStringContainsString( "const KEY   = 'lmt_rail_collapsed'", $script );
		$this->assertStringContainsString( 'dataset.initialTab', $script );
	}

	public function test_metabox_targets_native_fields_without_requesting_a_save() {
		$script = $this->asset_contents( 'metabox.js' );

		$this->assertStringContainsString( "'#attachment_alt'", $script );
		$this->assertStringContainsString( "'#attachment_caption'", $script );
		$this->assertStringContainsString( "'#attachment_content'", $script );
		$this->assertStringContainsString( 'Press Update to save.', $script );
		$this->assertStringNotContainsString( "save: '1'", $script );
	}
}
