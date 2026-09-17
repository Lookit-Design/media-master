<?php
/**
 * @package Lookit_Media_Master
 */

class Test_Lookit_Media_Master_MM3 extends WP_UnitTestCase {

	use LMT_Ajax_Test_Helper;

	private $files = array();

	private function create_image( $author, $filename, $width = 1200, $height = 900, $title = null ) {
		$id = self::factory()->attachment->create(
			array(
				'post_author'    => $author,
				'post_mime_type' => 'image/jpeg',
				'post_status'    => 'inherit',
				'post_title'     => null === $title ? pathinfo( $filename, PATHINFO_FILENAME ) : $title,
			)
		);
		update_post_meta( $id, '_wp_attached_file', '2026/09/' . $filename );
		wp_update_attachment_metadata(
			$id,
			array(
				'width'  => $width,
				'height' => $height,
			)
		);
		return $id;
	}

	public function tear_down() {
		foreach ( $this->files as $file ) {
			wp_delete_file( $file );
		}
		$this->files = array();
		$_POST       = array();
		$_REQUEST    = array();
		parent::tear_down();
	}

	private function create_image_file( $author ) {
		$uploads = wp_upload_dir();
		$file    = trailingslashit( $uploads['basedir'] ) . wp_unique_filename( $uploads['basedir'], 'mm3-source.jpg' );
		$image   = imagecreatetruecolor( 1, 1 );
		imagejpeg( $image, $file );
		$this->files[] = $file;
		$id            = $this->create_image( $author, basename( $file ), 1, 1 );
		update_post_meta( $id, '_wp_attached_file', basename( $file ) );
		return $id;
	}

	public function test_fit_dimensions_handles_landscape_portrait_and_no_upscale() {
		$this->assertSame(
			array(
				'width'  => 1200,
				'height' => 800,
			),
			lmt_fit_dimensions( 2400, 1600, 1200, 900 )
		);
		$this->assertSame(
			array(
				'width'  => 450,
				'height' => 900,
			),
			lmt_fit_dimensions( 1200, 2400, 1200, 900 )
		);
		$this->assertSame(
			array(
				'width'  => 1200,
				'height' => 300,
			),
			lmt_fit_dimensions( 2400, 600, 1200, 900 )
		);
		$this->assertSame(
			array(
				'width'  => 600,
				'height' => 450,
			),
			lmt_fit_dimensions( 600, 450, 1200, 900 )
		);
		$this->assertWPError( lmt_fit_dimensions( 0, 900, 1200, 900 ) );
		$this->assertWPError( lmt_fit_dimensions( 1200, 900, -1200, 900 ) );
		$this->assertWPError( lmt_fit_dimensions( 1200, 900, 15, 900 ) );
		$this->assertWPError( lmt_fit_dimensions( 1200, 900, 9000, 900 ) );
	}

	public function test_resize_panel_uses_house_boxes_and_saved_width_and_height() {
		$admin = self::factory()->user->create( array( 'role' => 'administrator' ) );
		wp_set_current_user( $admin );
		ob_start();
		lmt_render_page();
		$html = ob_get_clean();

		$tiers = array( '2560', '1920', '2400', '1200', '1600', '800', '600' );
		$last  = -1;
		foreach ( $tiers as $tier ) {
			$position = strpos( $html, 'name="mlr_size" value="' . $tier . '"' );
			$this->assertNotFalse( $position );
			$this->assertGreaterThan( $last, $position );
			$last = $position;
		}
		$this->assertStringContainsString( 'id="mlr-saved-px"', $html );
		$this->assertStringContainsString( 'id="mlr-saved-h"', $html );
		$this->assertStringNotContainsString( 'name="mlr_resize_mode"', $html );
	}

	public function test_alt_grid_query_is_permission_scoped_and_paged() {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		$other  = self::factory()->user->create( array( 'role' => 'author' ) );
		$this->create_image( $author, 'one.jpg' );
		$this->create_image( $author, 'two.jpg' );
		$this->create_image( $author, 'three.jpg' );
		$this->create_image( $other, 'hidden.jpg' );
		wp_set_current_user( $author );

		$result = $this->run_ajax(
			'lmt_alt_get_batch',
			array(
				'page'     => 2,
				'per_page' => 2,
			)
		);

		$this->assertTrue( $result['success'] );
		$this->assertSame( 3, $result['data']['total'] );
		$this->assertSame( 2, $result['data']['pages'] );
		$this->assertCount( 1, $result['data']['items'] );
	}

	public function test_large_filter_pages_by_measured_dimensions() {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		$this->create_image( $author, 'small.jpg', 1200, 900 );
		$this->create_image( $author, 'wide.jpg', 1300, 700 );
		$this->create_image( $author, 'portrait.jpg', 900, 1400 );
		wp_set_current_user( $author );

		$result = $this->run_ajax(
			'lmt_mlr_get_images',
			array(
				'filter'   => 'large',
				'page'     => 2,
				'per_page' => 1,
			)
		);

		$this->assertTrue( $result['success'] );
		$this->assertSame( 2, $result['data']['total'] );
		$this->assertSame( 2, $result['data']['pages'] );
		$this->assertCount( 1, $result['data']['items'] );
	}

	public function test_title_stats_and_filters_refresh_after_title_change() {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		$auto   = $this->create_image( $author, 'automatic-title.jpg' );
		$this->create_image( $author, 'custom-file.jpg', 1200, 900, 'Custom title' );
		wp_set_current_user( $author );

		$before     = $this->run_ajax( 'lmt_title_stats' );
		$filter     = $this->run_ajax(
			'lmt_title_get_batch',
			array(
				'filter'   => 'auto',
				'per_page' => 1,
			)
		);
		$generation = lmt_media_cache_generation( 'lmt_title_cache_generation' );
		wp_update_post(
			array(
				'ID'         => $auto,
				'post_title' => 'Rewritten title',
			)
		);
		$this->assertSame( 'Rewritten title', get_post_field( 'post_title', $auto ) );
		$this->assertGreaterThan( $generation, lmt_media_cache_generation( 'lmt_title_cache_generation' ) );
		$this->assertFalse( lmt_auto_title_library_map()[ $auto ] );
		$after = $this->run_ajax( 'lmt_title_stats' );

		$this->assertSame(
			array(
				'total'  => 2,
				'auto'   => 1,
				'custom' => 1,
			),
			$before['data']
		);
		$this->assertSame( 1, $filter['data']['total'] );
		$this->assertCount( 1, $filter['data']['items'] );
		$this->assertSame(
			array(
				'total'  => 2,
				'auto'   => 0,
				'custom' => 2,
			),
			$after['data']
		);
	}

	public function test_usage_batch_filters_ids_caps_input_and_invalidates_cache() {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		$other  = self::factory()->user->create( array( 'role' => 'author' ) );
		$own    = $this->create_image( $author, 'used.jpg' );
		$hidden = $this->create_image( $other, 'hidden-used.jpg' );
		$post   = self::factory()->post->create( array( 'post_content' => '<img class="wp-image-' . $own . '">' ) );
		wp_set_current_user( $author );

		$first = $this->run_ajax( 'lmt_usage_counts', array( 'ids' => array( $own, $hidden ) ) );
		wp_update_post(
			array(
				'ID'           => $post,
				'post_content' => '',
			)
		);
		$second = $this->run_ajax( 'lmt_usage_counts', array( 'ids' => array( $own, $hidden ) ) );

		$this->assertSame( array( (string) $own => 1 ), $first['data']['counts'] );
		$this->assertSame( array( (string) $own => 0 ), $second['data']['counts'] );

		$ids = array();
		for ( $index = 0; $index < 101; $index++ ) {
			$ids[] = $this->create_image( $author, 'cap-' . $index . '.jpg' );
		}
		$capped = $this->run_ajax( 'lmt_usage_counts', array( 'ids' => $ids ) );
		$this->assertCount( 100, $capped['data']['counts'] );
	}

	public function test_webp_save_validates_payload_and_source_ownership() {
		$owner = self::factory()->user->create( array( 'role' => 'author' ) );
		$other = self::factory()->user->create( array( 'role' => 'author' ) );
		$id    = $this->create_image_file( $owner );
		$webp  = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vuUAAA=';

		wp_set_current_user( $other );
		$denied = $this->run_ajax(
			'lmt_mlr_save_webp',
			array(
				'id'         => $id,
				'data'       => $webp,
				'max_width'  => 16,
				'max_height' => 16,
			)
		);
		$this->assertFalse( $denied['success'] );

		wp_set_current_user( $owner );
		global $wp_filesystem;
		require_once ABSPATH . 'wp-admin/includes/file.php';
		WP_Filesystem();
		$jpeg       = base64_encode( $wp_filesystem->get_contents( get_attached_file( $id ) ) ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- Builds an intentionally mislabeled image data URI for MIME validation.
		$wrong_mime = $this->run_ajax(
			'lmt_mlr_save_webp',
			array(
				'id'         => $id,
				'data'       => 'data:image/webp;base64,' . $jpeg,
				'max_width'  => 16,
				'max_height' => 16,
			)
		);
		$this->assertFalse( $wrong_mime['success'] );

		$saved = $this->run_ajax(
			'lmt_mlr_save_webp',
			array(
				'id'         => $id,
				'data'       => $webp,
				'max_width'  => 16,
				'max_height' => 16,
			)
		);
		$this->assertTrue( $saved['success'] );
		$this->assertSame( $id, $saved['data']['source'] );
		$this->assertTrue( lmt_user_can_edit_attachment( $saved['data']['id'] ) );
		$this->files[] = get_attached_file( $saved['data']['id'] );
	}
}
