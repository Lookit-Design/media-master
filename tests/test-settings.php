<?php
/**
 * @package Lookit_Media_Master
 */

class Test_Lookit_Media_Master_Settings extends WP_UnitTestCase {

	const SECRET = 'secret-token-value';

	public function tear_down() {
		delete_option( 'lmt_n8n_token' );
		delete_option( 'lmt_n8n_endpoint' );
		parent::tear_down();
	}

	public function test_sanitize_blank_keeps_existing_token() {
		update_option( 'lmt_n8n_token', self::SECRET );

		$this->assertSame( self::SECRET, lmt_sanitize_n8n_token( '' ) );
	}

	public function test_sanitize_replaces_token_when_new_value_submitted() {
		update_option( 'lmt_n8n_token', 'old-token' );

		$this->assertSame( 'new-token', lmt_sanitize_n8n_token( '  new-token  ' ) );
	}

	public function test_render_field_never_outputs_the_saved_token() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		update_option( 'lmt_n8n_token', self::SECRET );

		ob_start();
		lmt_render_settings_page();
		$html = ob_get_clean();

		$this->assertStringNotContainsString( self::SECRET, $html );
		$this->assertStringContainsString( 'value=""', $html );
	}

	public function test_maybe_disable_autoload_removes_token_from_autoload() {
		delete_option( 'lmt_n8n_token' );
		add_option( 'lmt_n8n_token', self::SECRET, '', 'yes' );

		$this->assertArrayHasKey( 'lmt_n8n_token', wp_load_alloptions() );

		lmt_maybe_disable_autoload();

		$this->assertArrayNotHasKey( 'lmt_n8n_token', wp_load_alloptions() );
		$this->assertSame( self::SECRET, get_option( 'lmt_n8n_token' ) );
	}
}
