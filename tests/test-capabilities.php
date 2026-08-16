<?php
/**
 * @package Lookit_Media_Master
 */

class Test_Lookit_Media_Master_Capabilities extends WP_UnitTestCase {

	private function make_attachment( $author_id ) {
		return self::factory()->post->create(
			array(
				'post_type'      => 'attachment',
				'post_mime_type' => 'image/jpeg',
				'post_author'    => $author_id,
				'post_status'    => 'inherit',
				'post_title'     => 'Owned image',
			)
		);
	}

	public function test_author_cannot_edit_another_authors_attachment() {
		$owner = self::factory()->user->create( array( 'role' => 'author' ) );
		$other = self::factory()->user->create( array( 'role' => 'author' ) );
		$id    = $this->make_attachment( $owner );

		wp_set_current_user( $other );
		$this->assertFalse( lmt_user_can_edit_attachment( $id ) );

		wp_set_current_user( $owner );
		$this->assertTrue( lmt_user_can_edit_attachment( $id ) );
	}

	public function test_regular_posts_are_not_treated_as_attachments() {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		$post   = self::factory()->post->create( array( 'post_author' => $author ) );

		wp_set_current_user( $author );
		$this->assertFalse( lmt_user_can_edit_attachment( $post ) );
	}

	public function test_decode_accepts_png_and_rejects_garbage() {
		$png = base64_decode( 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- fixture bytes.
		$ok  = lmt_decode_image_data_uri( 'data:image/png;base64,' . base64_encode( $png ) ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- data URI fixture.
		$this->assertIsArray( $ok );
		$this->assertSame( 'image/png', $ok['mime'] );

		$bad = lmt_decode_image_data_uri( 'data:image/png;base64,' . base64_encode( 'not-an-image' ) ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- invalid payload fixture.
		$this->assertWPError( $bad );
	}
}
