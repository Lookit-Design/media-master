<?php
/**
 * @package Lookit_Media_Master
 */

class Test_Lookit_Media_Master_MM4 extends WP_UnitTestCase {

	use LMT_Ajax_Test_Helper;

	private function create_image( $author ) {
		$id = self::factory()->attachment->create(
			array(
				'post_author'    => $author,
				'post_mime_type' => 'image/jpeg',
				'post_status'    => 'inherit',
				'post_title'     => 'MM4 image',
				'post_excerpt'   => '',
				'post_content'   => '',
			)
		);
		update_post_meta( $id, '_wp_attached_file', '2026/09/mm4-image.jpg' );
		return $id;
	}

	private function project_file( $path ) {
		global $wp_filesystem;
		require_once ABSPATH . 'wp-admin/includes/file.php';
		WP_Filesystem();
		return $wp_filesystem->get_contents( dirname( __DIR__ ) . '/' . $path );
	}

	public function tear_down() {
		$_GET     = array();
		$_POST    = array();
		$_REQUEST = array();
		parent::tear_down();
	}

	public function test_bulk_generation_skips_each_populated_field_unless_overwrite_is_enabled() {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		$id     = $this->create_image( $author );
		update_post_meta( $id, '_wp_attachment_image_alt', 'Existing alt' );
		wp_update_post(
			array(
				'ID'           => $id,
				'post_excerpt' => 'Existing caption',
				'post_content' => 'Existing description',
			)
		);
		wp_set_current_user( $author );

		$alt         = $this->run_ajax(
			'lmt_ai_alt_generate',
			array(
				'id'        => $id,
				'save'      => '1',
				'overwrite' => '0',
			)
		);
		$caption     = $this->run_ajax(
			'lmt_meta_generate',
			array(
				'id'        => $id,
				'field'     => 'caption',
				'save'      => '1',
				'overwrite' => '0',
			)
		);
		$description = $this->run_ajax(
			'lmt_meta_generate',
			array(
				'id'        => $id,
				'field'     => 'description',
				'save'      => '1',
				'overwrite' => '0',
			)
		);
		$overwrite   = $this->run_ajax(
			'lmt_meta_generate',
			array(
				'id'        => $id,
				'field'     => 'caption',
				'save'      => '1',
				'overwrite' => '1',
			)
		);

		$this->assertTrue( $alt['data']['skipped'] );
		$this->assertTrue( $caption['data']['skipped'] );
		$this->assertTrue( $description['data']['skipped'] );
		$this->assertFalse( $overwrite['success'] );
		$this->assertSame( 'Existing alt', get_post_meta( $id, '_wp_attachment_image_alt', true ) );
		$this->assertSame( 'Existing caption', get_post_field( 'post_excerpt', $id ) );
		$this->assertSame( 'Existing description', get_post_field( 'post_content', $id ) );
	}

	public function test_context_prompts_keep_facts_and_are_not_persisted() {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		$id     = $this->create_image( $author );
		$fact   = 'Logo by Ricky';
		wp_set_current_user( $author );

		$caption     = lmt_context_prompt_suffix( 'caption', $fact );
		$description = lmt_context_prompt_suffix( 'description', $fact );

		$this->assertStringContainsString( $fact, $caption );
		$this->assertStringContainsString( 'keep the supplied facts', $caption );
		$this->assertStringContainsString( 'Photo by Ricky', $caption );
		$this->assertStringContainsString( $fact, $description );
		$this->assertStringContainsString( 'include every one of those facts', $description );
		$this->assertStringContainsString( 'designed by Ricky', $description );
		$this->assertSame( '', get_post_field( 'post_excerpt', $id ) );
		$this->assertSame( '', get_post_field( 'post_content', $id ) );
		ob_start();
		lmt_render_attachment_page( $id );
		$html = ob_get_clean();
		$this->assertStringContainsString( 'id="lmt-att-context-caption"', $html );
		$this->assertStringContainsString( 'id="lmt-att-context-description"', $html );
		$this->assertStringNotContainsString( $fact, $html );
	}

	public function test_grid_thumbnail_uses_768_source_and_fallback_chain() {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		$id     = $this->create_image( $author );
		$meta   = array(
			'width'  => 1600,
			'height' => 1200,
			'file'   => '2026/09/mm4-image.jpg',
			'sizes'  => array(
				'medium_large' => array(
					'file'      => 'mm4-image-768x576.jpg',
					'width'     => 768,
					'height'    => 576,
					'mime-type' => 'image/jpeg',
				),
				'large'        => array(
					'file'      => 'mm4-image-1024x768.jpg',
					'width'     => 1024,
					'height'    => 768,
					'mime-type' => 'image/jpeg',
				),
				'medium'       => array(
					'file'      => 'mm4-image-300x225.jpg',
					'width'     => 300,
					'height'    => 225,
					'mime-type' => 'image/jpeg',
				),
			),
		);

		wp_update_attachment_metadata( $id, $meta );
		$this->assertStringEndsWith( 'mm4-image-768x576.jpg', lmt_grid_thumb_url( $id ) );
		unset( $meta['sizes']['medium_large'] );
		wp_update_attachment_metadata( $id, $meta );
		$this->assertStringEndsWith( 'mm4-image-1024x768.jpg', lmt_grid_thumb_url( $id ) );
		unset( $meta['sizes']['large'] );
		wp_update_attachment_metadata( $id, $meta );
		$this->assertStringEndsWith( 'mm4-image-300x225.jpg', lmt_grid_thumb_url( $id ) );
		unset( $meta['sizes'] );
		wp_update_attachment_metadata( $id, $meta );
		$this->assertStringEndsWith( 'mm4-image.jpg', lmt_grid_thumb_url( $id ) );
	}

	public function test_logo_and_release_metadata_are_versioned() {
		$admin = self::factory()->user->create( array( 'role' => 'administrator' ) );
		wp_set_current_user( $admin );
		ob_start();
		lmt_render_page();
		$html = ob_get_clean();

		$this->assertStringContainsString( 'assets/logo-mark.png?ver=3.42.5', $html );
		$this->assertStringContainsString( 'id="alt-ai-field-alt" checked', $html );
		$this->assertStringContainsString( 'id="alt-ai-field-caption"><span>Caption</span>', $html );
		$this->assertStringContainsString( 'id="alt-ai-field-description"><span>Description</span>', $html );
		$this->assertFileExists( dirname( __DIR__ ) . '/assets/logo-mark.png' );
		$readme = $this->project_file( 'readme.txt' );
		$this->assertStringContainsString( 'Stable tag: 3.42.5', $readme );
		$this->assertStringContainsString( '= 3.42.5 =', $this->project_file( 'changelog.txt' ) );
		$this->assertStringContainsString( 'Older entries are in changelog.txt', $readme );
		$this->assertLessThan( 5000, strlen( strstr( $readme, '== Changelog ==' ) ) );
	}

	public function test_connection_payload_and_authenticated_request_shape() {
		$payload = lmt_connection_test_payload();
		$args    = lmt_n8n_request_args( 'endpoint-secret', $payload['data_uri'], $payload['mime'], $payload['prompt'] );
		$body    = json_decode( $args['body'], true );

		$this->assertSame( 'image/png', $body['mime'] );
		$this->assertStringStartsWith( 'data:image/png;base64,', $body['image'] );
		$this->assertSame( 'This is a connection test. Reply with just the two letters: OK', $body['prompt'] );
		$this->assertSame( get_site_url(), $body['site']['url'] );
		$this->assertSame( 'Bearer endpoint-secret', $args['headers']['Authorization'] );
		$this->assertArrayNotHasKey( 'Authorization', lmt_n8n_request_args( '', 'image', 'image/png', 'prompt' )['headers'] );
	}

	public function test_bulk_picker_and_context_ui_contracts() {
		$script = $this->project_file( 'assets/app.js' );
		$styles = $this->project_file( 'assets/style.css' );

		$this->assertStringContainsString( 'const AI_FIELDS = [', $script );
		$this->assertStringContainsString( "{ key: 'caption'", $script );
		$this->assertStringContainsString( "{ key: 'description'", $script );
		$this->assertStringContainsString( "post('lmt_meta_generate', { id, field, save: '1', overwrite: write })", $script );
		$this->assertStringContainsString( 'overwrite: write', $script );
		$this->assertStringContainsString( 'Generated using your extra context.', $script );
		$this->assertStringContainsString( 'body.context = val', $script );
		$this->assertStringContainsString( 'const LMT_SIZE_MIN = 240', $script );
		$this->assertStringContainsString( '.lmt-stat-go', $styles );
		$this->assertStringContainsString( 'color: inherit', $styles );
		$this->assertStringContainsString( 'flex: 1 1 108px', $styles );
	}
}
