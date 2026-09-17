<?php
/**
 * @package Lookit_Media_Master
 */

class Test_Lookit_Media_Master_Metadata extends WP_UnitTestCase {

	use LMT_Ajax_Test_Helper;

	private function create_image( $author, $title, $date = '2024-01-01 12:00:00' ) {
		return self::factory()->attachment->create(
			array(
				'post_author'    => $author,
				'post_mime_type' => 'image/jpeg',
				'post_title'     => $title,
				'post_date'      => $date,
			)
		);
	}

	public function tear_down() {
		$_POST    = array();
		$_REQUEST = array();
		parent::tear_down();
	}

	public function test_metadata_save_updates_all_fields_and_sanitizes_values() {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		$id     = $this->create_image( $author, 'Original title' );
		wp_set_current_user( $author );

		$result = $this->run_ajax(
			'lmt_alt_save',
			array(
				'id'          => $id,
				'alt'         => '  New alt  ',
				'caption'     => '<strong>Caption</strong><script>bad()</script>',
				'description' => '<p>Description</p><script>bad()</script>',
				'title'       => '  New title  ',
			)
		);

		$this->assertTrue( $result['success'] );
		$this->assertSame( 'New alt', get_post_meta( $id, '_wp_attachment_image_alt', true ) );
		$this->assertSame( '<strong>Caption</strong>bad()', get_post_field( 'post_excerpt', $id ) );
		$this->assertSame( '<p>Description</p>bad()', get_post_field( 'post_content', $id ) );
		$this->assertSame( 'New title', get_post_field( 'post_title', $id ) );
	}

	public function test_bulk_alt_skips_existing_value_unless_overwrite_is_requested() {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		$id     = $this->create_image( $author, 'Post title' );
		update_post_meta( $id, '_wp_attachment_image_alt', 'Existing alt' );
		wp_set_current_user( $author );

		$skipped = $this->run_ajax(
			'lmt_alt_process_one',
			array(
				'id'        => $id,
				'overwrite' => '0',
			)
		);
		$this->assertTrue( $skipped['data']['skipped'] );
		$this->assertSame( 'Existing alt', get_post_meta( $id, '_wp_attachment_image_alt', true ) );

		$updated = $this->run_ajax(
			'lmt_alt_process_one',
			array(
				'id'        => $id,
				'overwrite' => '1',
			)
		);
		$this->assertFalse( $updated['data']['skipped'] );
		$this->assertSame( 'Post title', get_post_meta( $id, '_wp_attachment_image_alt', true ) );
	}

	public function test_metadata_handlers_reject_another_authors_attachment() {
		$owner  = self::factory()->user->create( array( 'role' => 'author' ) );
		$other  = self::factory()->user->create( array( 'role' => 'author' ) );
		$id     = $this->create_image( $owner, 'Protected title' );
		$before = get_post_field( 'post_excerpt', $id );
		wp_set_current_user( $other );

		$save = $this->run_ajax(
			'lmt_alt_save',
			array(
				'id'      => $id,
				'caption' => 'Changed',
			)
		);
		$get  = $this->run_ajax( 'lmt_attachment_get', array( 'id' => $id ) );
		$ai   = $this->run_ajax(
			'lmt_meta_generate',
			array(
				'id'    => $id,
				'field' => 'caption',
			)
		);

		$this->assertFalse( $save['success'] );
		$this->assertFalse( $get['success'] );
		$this->assertFalse( $ai['success'] );
		$this->assertSame( $before, get_post_field( 'post_excerpt', $id ) );
	}

	public function test_metadata_handlers_require_upload_permission() {
		$owner = self::factory()->user->create( array( 'role' => 'author' ) );
		$id    = $this->create_image( $owner, 'Protected title' );
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'subscriber' ) ) );

		$result = $this->run_ajax( 'lmt_attachment_get', array( 'id' => $id ) );

		$this->assertSame( 'Forbidden', $result['die'] );
	}

	public function test_attachment_record_returns_metadata_and_only_accessible_neighbors() {
		$owner = self::factory()->user->create( array( 'role' => 'author' ) );
		$other = self::factory()->user->create( array( 'role' => 'author' ) );
		$older = $this->create_image( $owner, 'Older', '2024-01-01 12:00:00' );
		$this->create_image( $other, 'Hidden middle', '2024-02-01 12:00:00' );
		$newer = $this->create_image( $owner, 'Newer', '2024-03-01 12:00:00' );
		update_post_meta( $newer, '_wp_attachment_image_alt', 'Newer alt' );
		wp_update_post(
			array(
				'ID'           => $newer,
				'post_excerpt' => 'Newer caption',
				'post_content' => 'Newer description',
			)
		);
		wp_set_current_user( $owner );

		$record = lmt_attachment_record( $newer );

		$this->assertSame( 'Newer alt', $record['alt'] );
		$this->assertSame( 'Newer caption', $record['caption'] );
		$this->assertSame( 'Newer description', $record['description'] );
		$this->assertStringEndsWith( 'id=' . $older, $record['prev_url'] );
		$this->assertSame( '', $record['next_url'] );
	}

	public function test_metadata_filters_counts_and_pagination_exclude_inaccessible_images() {
		$owner        = self::factory()->user->create( array( 'role' => 'author' ) );
		$other        = self::factory()->user->create( array( 'role' => 'author' ) );
		$own_missing  = $this->create_image( $owner, 'Own missing' );
		$own_complete = $this->create_image( $owner, 'Own complete' );
		$this->create_image( $other, 'Other missing' );
		wp_update_post(
			array(
				'ID'           => $own_missing,
				'post_excerpt' => '',
				'post_content' => '',
			)
		);
		update_post_meta( $own_complete, '_wp_attachment_image_alt', 'Alt' );
		wp_update_post(
			array(
				'ID'           => $own_complete,
				'post_excerpt' => 'Caption',
				'post_content' => 'Description',
			)
		);
		wp_set_current_user( $owner );

		$counts = lmt_metadata_counts();
		$list   = $this->run_ajax(
			'lmt_alt_get_batch',
			array(
				'page'     => 1,
				'per_page' => 1,
				'filter'   => 'missing_any',
			)
		);

		$this->assertSame( 2, $counts['total'] );
		$this->assertSame( 1, $counts['missing'] );
		$this->assertSame( 1, $counts['missing_caption'] );
		$this->assertSame( 1, $counts['missing_desc'] );
		$this->assertSame( 1, $list['data']['total'] );
		$this->assertSame( $own_missing, $list['data']['items'][0]['id'] );
	}

	public function test_caption_and_description_prompts_use_custom_or_default_values() {
		$this->assertNotSame( '', lmt_field_prompt( 'caption' ) );
		$this->assertNotSame( '', lmt_field_prompt( 'description' ) );

		update_option( 'lmt_ai_caption_prompt', 'Custom caption prompt' );
		update_option( 'lmt_ai_desc_prompt', 'Custom description prompt' );

		$this->assertSame( 'Custom caption prompt', lmt_field_prompt( 'caption' ) );
		$this->assertSame( 'Custom description prompt', lmt_field_prompt( 'description' ) );
	}

	public function test_generated_metadata_only_overwrites_when_save_is_requested() {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		$id     = $this->create_image( $author, 'Generated metadata' );
		wp_update_post(
			array(
				'ID'           => $id,
				'post_excerpt' => 'Existing caption',
				'post_content' => 'Existing description',
			)
		);
		wp_set_current_user( $author );

		$preview = lmt_apply_generated_metadata( $id, 'caption', 'Generated caption', false );
		$this->assertFalse( $preview['saved'] );
		$this->assertSame( 'Existing caption', get_post_field( 'post_excerpt', $id ) );

		$saved = lmt_apply_generated_metadata( $id, 'description', 'Generated description', true );
		$this->assertTrue( $saved['saved'] );
		$this->assertSame( 'Generated description', get_post_field( 'post_content', $id ) );
	}
}
