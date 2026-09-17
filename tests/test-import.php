<?php
/**
 * @package Lookit_Media_Master
 */

class Test_Lookit_Media_Master_Import extends WP_UnitTestCase {

	use LMT_Ajax_Test_Helper;

	public function tear_down() {
		$_FILES   = array();
		$_POST    = array();
		$_REQUEST = array();
		parent::tear_down();
	}

	private function create_png_upload( $name = 'import.png' ) {
		global $wp_filesystem;

		require_once ABSPATH . 'wp-admin/includes/file.php';
		WP_Filesystem();
		$path = wp_tempnam( $name );
		$png  = base64_decode( 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- Image fixture bytes.
		$wp_filesystem->put_contents( $path, $png );

		return array(
			'name'     => $name,
			'tmp_name' => $path,
			'error'    => UPLOAD_ERR_OK,
			'size'     => strlen( $png ),
			'type'     => 'image/png',
		);
	}

	public function test_sideload_import_creates_a_real_media_attachment() {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		wp_set_current_user( $author );
		$file = $this->create_png_upload();

		$id = lmt_import_media_file( $file, 0, true );

		$this->assertIsInt( $id );
		$this->assertSame( 'attachment', get_post_type( $id ) );
		$this->assertSame( 'image/png', get_post_mime_type( $id ) );
		$this->assertSame( $author, (int) get_post_field( 'post_author', $id ) );
		$this->assertFileExists( get_attached_file( $id ) );
		wp_delete_attachment( $id, true );
	}

	public function test_import_rejects_disallowed_mime_and_upload_errors() {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		wp_set_current_user( $author );
		$file          = $this->create_png_upload( 'script.php' );
		$invalid_mime  = lmt_import_media_file( $file, 0, true );
		$file['name']  = 'image.png';
		$file['error'] = UPLOAD_ERR_INI_SIZE;
		$upload_error  = lmt_import_media_file( $file, 0, true );

		$this->assertWPError( $invalid_mime );
		$this->assertSame( 'invalid_mime', $invalid_mime->get_error_code() );
		$this->assertWPError( $upload_error );
		$this->assertSame( 'upload_error', $upload_error->get_error_code() );
		wp_delete_file( $file['tmp_name'] );
	}

	public function test_import_rejects_user_without_upload_permission() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'subscriber' ) ) );
		$file   = $this->create_png_upload();
		$result = lmt_import_media_file( $file, 0, true );

		$this->assertWPError( $result );
		$this->assertSame( 'permission_denied', $result->get_error_code() );
		wp_delete_file( $file['tmp_name'] );
	}

	public function test_import_rejects_parent_the_uploader_cannot_edit() {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		$other  = self::factory()->user->create( array( 'role' => 'author' ) );
		$parent = self::factory()->post->create( array( 'post_author' => $other ) );
		wp_set_current_user( $author );
		$file   = $this->create_png_upload();
		$result = lmt_import_media_file( $file, $parent, true );

		$this->assertWPError( $result );
		$this->assertSame( 'permission_denied', $result->get_error_code() );
		wp_delete_file( $file['tmp_name'] );
	}

	public function test_import_ajax_reports_capabilities_and_rejects_missing_file() {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		wp_set_current_user( $author );

		$capabilities = $this->run_ajax( 'lmt_import_caps' );
		$missing      = $this->run_ajax( 'lmt_import_upload' );

		$this->assertTrue( $capabilities['success'] );
		$this->assertSame( wp_max_upload_size(), $capabilities['data']['max_upload'] );
		$this->assertFalse( $missing['success'] );
		$this->assertSame( 'No file received.', $missing['data']['message'] );
	}

	public function test_import_ajax_rejects_user_without_upload_permission() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'subscriber' ) ) );

		$result = $this->run_ajax( 'lmt_import_upload' );

		$this->assertFalse( $result['success'] );
		$this->assertSame( 'Permission denied.', $result['data']['message'] );
	}

	public function test_import_ajax_rejects_invalid_nonce() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'author' ) ) );

		$result = $this->run_ajax( 'lmt_import_caps', array( 'nonce' => 'invalid' ) );

		$this->assertSame( '-1', $result['die'] );
	}
}
