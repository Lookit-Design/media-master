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

	public function test_app_uses_box_resize_presets_and_deferred_usage_counts() {
		$script = $this->asset_contents( 'app.js' );

		$this->assertStringContainsString( 'scale = Math.min(t.w ? t.w / w : 1, t.h ? t.h / h : 1)', $script );
		$this->assertStringContainsString( 'max_width: target.w, max_height: target.h', $script );
		$this->assertStringContainsString( 'data-h="${s.h || \'\'}"', $script );
		$this->assertStringContainsString( 'text: `↓ Save ~${formatBytes(saved)} at ${Math.round(w * scale)}×${Math.round(h * scale)}`', $script );
		$this->assertStringContainsString( "action: 'lmt_usage_counts'", $script );
		$this->assertStringContainsString( 'offset += 100', $script );
		$this->assertStringContainsString( "document.getElementById('alt-select-all')", $script );
		$this->assertStringContainsString( "document.getElementById('title-select-all')", $script );
	}
}
