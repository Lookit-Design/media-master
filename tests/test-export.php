<?php
/**
 * @package Lookit_Media_Master
 */

class Test_Lookit_Media_Master_Export extends WP_UnitTestCase {

	use LMT_Ajax_Test_Helper;

	private function run_download( $job_id, $user_id ) {
		wp_set_current_user( $user_id );
		$_GET     = array(
			'action'   => 'lmt_export_download',
			'job'      => $job_id,
			'part'     => '1',
			'_wpnonce' => wp_create_nonce( 'lmt_export_dl_' . $job_id ),
		);
		$_REQUEST = $_GET; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Test request includes a generated nonce.

		$filter = static function () {
			return static function ( $message ) {
				throw new RuntimeException( sanitize_text_field( (string) $message ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Exception text is asserted, not rendered.
			};
		};
		add_filter( 'wp_die_ajax_handler', $filter );

		try {
			do_action( 'wp_ajax_lmt_export_download' );
		} catch ( RuntimeException $exception ) {
			remove_filter( 'wp_die_ajax_handler', $filter );
			return $exception->getMessage();
		}

		remove_filter( 'wp_die_ajax_handler', $filter );
		$this->fail( 'Download action did not terminate.' );
	}

	private function create_attachment_file( $author, $name, $mime, $title = '', $bytes = 0 ) {
		global $wp_filesystem;

		require_once ABSPATH . 'wp-admin/includes/file.php';
		WP_Filesystem();
		$uploads = wp_upload_dir();
		wp_mkdir_p( $uploads['path'] );
		$path     = trailingslashit( $uploads['path'] ) . $name;
		$contents = $bytes ? str_repeat( 'x', $bytes ) : 'lookit export fixture';
		$wp_filesystem->put_contents( $path, $contents );

		$id = self::factory()->attachment->create(
			array(
				'post_author'    => $author,
				'post_mime_type' => $mime,
				'post_title'     => $title ? $title : $name,
				'post_date'      => '2020-06-15 12:00:00',
			)
		);
		update_attached_file( $id, $path );

		return $id;
	}

	public function tear_down() {
		foreach ( (array) glob( lmt_export_base_dir() . '/*', GLOB_ONLYDIR ) as $directory ) {
			lmt_export_delete_job( wp_basename( $directory ) );
		}
		$_POST    = array();
		$_GET     = array();
		$_REQUEST = array();
		parent::tear_down();
	}

	public function test_job_ids_reject_traversal_and_accept_random_ids() {
		$this->assertFalse( lmt_export_valid_job_id( '../../wp-config.php' ) );
		$this->assertFalse( lmt_export_valid_job_id( str_repeat( 'a', 47 ) ) );
		$this->assertTrue( lmt_export_valid_job_id( str_repeat( 'a', 48 ) ) );
		$this->assertSame( '', lmt_export_job_path( '../invalid' ) );
	}

	public function test_csv_quotes_cells_and_neutralizes_formulas() {
		$csv = lmt_export_csv_line( array( '=cmd()', '+1', '-2', '@sum', 'safe', 'a"b' ) );

		$this->assertSame( "\"'=cmd()\",\"'+1\",\"'-2\",\"'@sum\",\"safe\",\"a\"\"b\"\r\n", $csv );
	}

	public function test_only_job_owner_with_upload_permission_can_access_job() {
		$owner = self::factory()->user->create( array( 'role' => 'author' ) );
		$other = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$job   = array( 'user' => $owner );

		wp_set_current_user( $other );
		$this->assertFalse( lmt_export_user_can_access_job( $job ) );

		wp_set_current_user( $owner );
		$this->assertTrue( lmt_export_user_can_access_job( $job ) );
	}

	public function test_export_includes_only_attachments_the_user_can_edit() {
		$owner    = self::factory()->user->create( array( 'role' => 'author' ) );
		$other    = self::factory()->user->create( array( 'role' => 'author' ) );
		$own_id   = self::factory()->attachment->create( array( 'post_author' => $owner ) );
		$other_id = self::factory()->attachment->create( array( 'post_author' => $other ) );

		wp_set_current_user( $owner );

		$this->assertSame( array( $own_id ), lmt_export_accessible_ids( array( $own_id, $other_id ) ) );
	}

	public function test_filters_select_type_year_attachment_and_search() {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		wp_set_current_user( $author );
		$parent = self::factory()->post->create( array( 'post_author' => $author ) );
		$image  = $this->create_attachment_file( $author, 'filter-image.jpg', 'image/jpeg', 'Needle image' );
		$audio  = $this->create_attachment_file( $author, 'filter-audio.mp3', 'audio/mpeg', 'Other media' );
		wp_update_post(
			array(
				'ID'          => $image,
				'post_parent' => $parent,
			)
		);

		$args = lmt_export_query_args(
			array(
				'type'     => 'image',
				'range'    => 'year:2020',
				'attached' => 'attached',
				'search'   => 'Needle',
			)
		);
		$ids  = get_posts( $args );

		$this->assertSame( array( $image ), $ids );
		$this->assertNotContains( $audio, $ids );

		$args['post_parent'] = 0;
		unset( $args['post_parent__not_in'] );
		$this->assertSame( array(), get_posts( $args ) );
	}

	public function test_folder_modes_produce_expected_safe_paths() {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		$parent = self::factory()->post->create(
			array(
				'post_author' => $author,
				'post_title'  => 'Example Parent',
			)
		);
		$id     = $this->create_attachment_file( $author, 'folder-image.jpg', 'image/jpeg' );
		wp_update_post(
			array(
				'ID'          => $id,
				'post_parent' => $parent,
			)
		);
		$file    = get_attached_file( $id );
		$uploads = wp_upload_dir();

		$this->assertSame( 'folder-image.jpg', lmt_export_zip_path( $id, $file, 'flat', $uploads['basedir'] ) );
		$this->assertSame( 'images/folder-image.jpg', lmt_export_zip_path( $id, $file, 'type', $uploads['basedir'] ) );
		$this->assertSame( 'example-parent-' . $parent . '/folder-image.jpg', lmt_export_zip_path( $id, $file, 'parent', $uploads['basedir'] ) );
		$this->assertStringEndsWith( '/folder-image.jpg', lmt_export_zip_path( $id, $file, 'uploads', $uploads['basedir'] ) );
	}

	public function test_export_years_and_archive_name_reflect_library_filters() {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		$other  = self::factory()->user->create( array( 'role' => 'author' ) );
		wp_set_current_user( $author );
		$older  = $this->create_attachment_file( $author, 'older.jpg', 'image/jpeg' );
		$newer  = $this->create_attachment_file( $author, 'newer.jpg', 'image/jpeg' );
		$hidden = $this->create_attachment_file( $other, 'hidden.jpg', 'image/jpeg' );
		wp_update_post(
			array(
				'ID'        => $older,
				'post_date' => '2018-02-01 12:00:00',
			)
		);
		wp_update_post(
			array(
				'ID'        => $newer,
				'post_date' => '2020-08-01 12:00:00',
			)
		);
		wp_update_post(
			array(
				'ID'        => $hidden,
				'post_date' => '2016-08-01 12:00:00',
			)
		);
		delete_transient( 'lmt_export_years_image_user_' . $author );

		$this->assertSame( array( 2020, 2018 ), lmt_export_years( 'image' ) );

		$name = lmt_export_basename(
			array(
				'type'  => 'image',
				'range' => 'year:2018',
			)
		);
		$this->assertStringStartsWith( 'media-export-', $name );
		$this->assertStringEndsWith( '-images-2018', $name );
	}

	public function test_ajax_job_lifecycle_builds_zip_and_manifest() {
		if ( ! class_exists( 'ZipArchive' ) ) {
			$this->markTestSkipped( 'ZipArchive is required for export integration coverage.' );
		}

		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		wp_set_current_user( $author );
		$id = $this->create_attachment_file( $author, 'lifecycle.txt', 'text/plain', '=Formula title' );

		$start = $this->run_ajax(
			'lmt_export_start',
			array(
				'type'      => 'all',
				'range'     => 'all',
				'attached'  => 'any',
				'folders'   => 'flat',
				'split'     => 0,
				'originals' => 1,
				'csv'       => 1,
			)
		);
		$this->assertTrue( $start['success'] );
		$this->assertSame( 1, $start['data']['total'] );

		$batch = $this->run_ajax( 'lmt_export_batch', array( 'job' => $start['data']['job'] ) );
		$this->assertTrue( $batch['success'] );
		$this->assertTrue( $batch['data']['complete'] );
		$this->assertSame( 1, $batch['data']['done'] );

		$final = $this->run_ajax( 'lmt_export_finalize', array( 'job' => $start['data']['job'] ) );
		$this->assertTrue( $final['success'] );
		$this->assertSame( 'ready', $final['data']['status'] );
		$this->assertCount( 1, $final['data']['parts'] );

		$job = lmt_export_read_job( $start['data']['job'] );
		$this->assertSame( array(), $job['ids'] );
		$target = lmt_export_download_target( $job, 1 );
		$this->assertIsArray( $target );

		$zip = new ZipArchive();
		$this->assertTrue( $zip->open( $target['path'] ) );
		$this->assertNotFalse( $zip->locateName( 'lifecycle.txt' ) );
		$manifest = $zip->getFromName( $job['base'] . '.csv' );
		$zip->close();
		$this->assertStringContainsString( "\"'=Formula title\"", $manifest );

		$jobs = $this->run_ajax( 'lmt_export_jobs' );
		$this->assertCount( 1, $jobs['data']['jobs'] );

		$deleted = $this->run_ajax( 'lmt_export_delete', array( 'job' => $job['id'] ) );
		$this->assertTrue( $deleted['success'] );
		$this->assertNull( lmt_export_read_job( $job['id'] ) );
	}

	public function test_start_rejects_empty_result_and_finalize_rejects_incomplete_job() {
		if ( ! class_exists( 'ZipArchive' ) ) {
			$this->markTestSkipped( 'ZipArchive is required for export integration coverage.' );
		}

		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		wp_set_current_user( $author );

		$empty = $this->run_ajax(
			'lmt_export_start',
			array(
				'type'     => 'audio',
				'range'    => 'all',
				'attached' => 'any',
			)
		);
		$this->assertFalse( $empty['success'] );

		$this->create_attachment_file( $author, 'incomplete.txt', 'text/plain' );
		$start = $this->run_ajax(
			'lmt_export_start',
			array(
				'type'     => 'all',
				'range'    => 'all',
				'attached' => 'any',
			)
		);
		$final = $this->run_ajax( 'lmt_export_finalize', array( 'job' => $start['data']['job'] ) );

		$this->assertFalse( $final['success'] );
		$this->assertSame( 'running', lmt_export_read_job( $start['data']['job'] )['status'] );
	}

	public function test_batching_splits_large_export_across_multiple_requests() {
		if ( ! class_exists( 'ZipArchive' ) ) {
			$this->markTestSkipped( 'ZipArchive is required for export integration coverage.' );
		}

		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		wp_set_current_user( $author );
		$this->create_attachment_file( $author, 'split-one.txt', 'text/plain', '', 600 * 1024 );
		$this->create_attachment_file( $author, 'split-two.txt', 'text/plain', '', 600 * 1024 );
		$start = $this->run_ajax(
			'lmt_export_start',
			array(
				'type'      => 'all',
				'range'     => 'all',
				'attached'  => 'any',
				'folders'   => 'flat',
				'split'     => 1,
				'originals' => 1,
			)
		);

		$first = $this->run_ajax( 'lmt_export_batch', array( 'job' => $start['data']['job'] ) );
		$this->assertFalse( $first['data']['complete'] );
		$this->assertSame( 1, $first['data']['done'] );
		$this->assertSame( 1, $first['data']['parts'] );

		$second = $this->run_ajax( 'lmt_export_batch', array( 'job' => $start['data']['job'] ) );
		$this->assertTrue( $second['data']['complete'] );
		$this->assertSame( 2, $second['data']['done'] );
		$this->assertSame( 2, $second['data']['parts'] );
	}

	public function test_batch_rechecks_attachment_permission_and_job_owner() {
		if ( ! class_exists( 'ZipArchive' ) ) {
			$this->markTestSkipped( 'ZipArchive is required for export integration coverage.' );
		}

		$owner = self::factory()->user->create( array( 'role' => 'author' ) );
		$other = self::factory()->user->create( array( 'role' => 'author' ) );
		wp_set_current_user( $owner );
		$id    = $this->create_attachment_file( $owner, 'permission.txt', 'text/plain' );
		$start = $this->run_ajax(
			'lmt_export_start',
			array(
				'type'     => 'all',
				'range'    => 'all',
				'attached' => 'any',
				'folders'  => 'flat',
			)
		);

		wp_set_current_user( $other );
		$denied = $this->run_ajax( 'lmt_export_batch', array( 'job' => $start['data']['job'] ) );
		$this->assertFalse( $denied['success'] );

		wp_set_current_user( $owner );
		wp_update_post(
			array(
				'ID'          => $id,
				'post_author' => $other,
			)
		);
		$batch = $this->run_ajax( 'lmt_export_batch', array( 'job' => $start['data']['job'] ) );
		$this->assertTrue( $batch['success'] );
		$this->assertSame( 1, $batch['data']['skipped'] );
		$this->assertSame( 0, $batch['data']['bytes'] );
	}

	public function test_download_target_rejects_paths_outside_job_directory() {
		global $wp_filesystem;

		require_once ABSPATH . 'wp-admin/includes/file.php';
		WP_Filesystem();
		$job_id = str_repeat( 'c', 48 );
		$base   = lmt_export_base_dir();
		wp_mkdir_p( $base . '/' . $job_id );
		$outside = trailingslashit( dirname( $base ) ) . 'outside.zip';
		$wp_filesystem->put_contents( $outside, 'outside' );
		$job = array(
			'id'    => $job_id,
			'parts' => array( $outside ),
		);

		$this->assertWPError( lmt_export_download_target( $job, 1 ) );
		wp_delete_file( $outside );
		lmt_export_delete_job( $job_id );
	}

	public function test_download_handler_rejects_a_different_user() {
		$owner  = self::factory()->user->create( array( 'role' => 'author' ) );
		$other  = self::factory()->user->create( array( 'role' => 'author' ) );
		$job_id = str_repeat( 'd', 48 );
		$dir    = lmt_export_base_dir() . '/' . $job_id;
		wp_mkdir_p( $dir );
		lmt_export_write_job(
			array(
				'id'     => $job_id,
				'user'   => $owner,
				'status' => 'ready',
				'parts'  => array(),
			)
		);

		$message = $this->run_download( $job_id, $other );

		$this->assertStringContainsString( 'Permission denied', $message );
	}

	public function test_cleanup_removes_only_expired_valid_job_directories() {
		global $wp_filesystem;

		$old_id    = str_repeat( 'a', 48 );
		$new_id    = str_repeat( 'b', 48 );
		$base      = lmt_export_base_dir();
		$unrelated = $base . '/unrelated';

		require_once ABSPATH . 'wp-admin/includes/file.php';
		WP_Filesystem();
		wp_mkdir_p( $base . '/' . $old_id );
		wp_mkdir_p( $base . '/' . $new_id );
		wp_mkdir_p( $unrelated );
		$wp_filesystem->put_contents( $base . '/' . $old_id . '/job.json', '{}' );
		$wp_filesystem->put_contents( $base . '/' . $new_id . '/job.json', '{}' );
		$wp_filesystem->put_contents( $unrelated . '/keep.txt', 'keep' );
		$wp_filesystem->touch( $base . '/' . $old_id . '/job.json', time() - 8 * DAY_IN_SECONDS );
		$wp_filesystem->touch( $unrelated . '/keep.txt', time() - 8 * DAY_IN_SECONDS );

		lmt_export_cleanup();

		$this->assertDirectoryDoesNotExist( $base . '/' . $old_id );
		$this->assertDirectoryExists( $base . '/' . $new_id );
		$this->assertDirectoryExists( $unrelated );
		lmt_export_delete_job( $new_id );
		$wp_filesystem->delete( $unrelated, true );
	}

	public function test_deactivation_clears_cleanup_event() {
		wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', 'lmt_export_cleanup_event' );

		do_action( 'deactivate_' . plugin_basename( dirname( __DIR__ ) . '/lookit-media-master.php' ) );

		$this->assertFalse( wp_next_scheduled( 'lmt_export_cleanup_event' ) );
	}
}
