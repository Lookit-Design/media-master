<?php
/**
 * @package Lookit_Media_Master
 */

class Test_Lookit_Media_Master_Admin_UI extends WP_UnitTestCase {

	const SECRET = 'existing-secret-7xQ9';

	private function create_image( $author ) {
		$id = self::factory()->attachment->create(
			array(
				'post_author'    => $author,
				'post_mime_type' => 'image/jpeg',
				'post_title'     => 'Admin UI image',
			)
		);
		update_post_meta( $id, '_wp_attached_file', '2024/01/admin-ui-image.jpg' );
		return $id;
	}

	public function tear_down() {
		delete_option( 'lmt_n8n_token' );
		delete_option( 'lmt_ai_caption_prompt' );
		delete_option( 'lmt_ai_desc_prompt' );
		delete_option( 'lmt_absorb_media_menu' );
		$_GET     = array();
		$_POST    = array();
		$_REQUEST = array();
		wp_dequeue_script( 'lmt-metabox' );
		wp_dequeue_style( 'lmt-metabox' );
		set_current_screen( 'front' );
		parent::tear_down();
	}

	public function test_settings_save_preserves_blank_token_and_sanitizes_new_options() {
		$admin = self::factory()->user->create( array( 'role' => 'administrator' ) );
		wp_set_current_user( $admin );
		add_option( 'lmt_n8n_token', self::SECRET, '', true );
		$_POST    = array(
			'lmt_save_settings'     => '1',
			'_wpnonce'              => wp_create_nonce( 'lmt_settings_save' ),
			'lmt_n8n_endpoint'      => 'https://example.com/hook',
			'lmt_n8n_token'         => '',
			'lmt_ai_prompt'         => 'Alt prompt',
			'lmt_ai_title_prompt'   => 'Title prompt',
			'lmt_ai_caption_prompt' => '<b>Caption prompt</b>',
			'lmt_ai_desc_prompt'    => 'Description prompt',
			'lmt_absorb_media_menu' => '1',
		);
		$_REQUEST = $_POST; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Test request contains a valid nonce.

		$this->assertTrue( lmt_settings_handle_save() );
		$this->assertSame( self::SECRET, get_option( 'lmt_n8n_token' ) );
		$this->assertArrayNotHasKey( 'lmt_n8n_token', wp_load_alloptions() );
		$this->assertSame( 'Caption prompt', get_option( 'lmt_ai_caption_prompt' ) );
		$this->assertSame( 'Description prompt', get_option( 'lmt_ai_desc_prompt' ) );
		$this->assertTrue( lmt_media_menu_absorbed() );

		ob_start();
		lmt_render_settings_panel();
		$html = ob_get_clean();
		$this->assertStringNotContainsString( self::SECRET, $html );
		$this->assertStringNotContainsString( substr( self::SECRET, -4 ), $html );
		$this->assertStringContainsString( 'A token is currently saved', $html );
	}

	public function test_settings_require_manage_options() {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		wp_set_current_user( $author );
		$_POST    = array(
			'lmt_save_settings' => '1',
			'_wpnonce'          => wp_create_nonce( 'lmt_settings_save' ),
		);
		$_REQUEST = $_POST; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Test request contains a valid nonce.

		$this->assertFalse( lmt_settings_handle_save() );

		ob_start();
		lmt_render_settings_panel();
		$html = ob_get_clean();
		$this->assertStringContainsString( 'do not have permission', $html );
		$this->assertStringNotContainsString( 'lmt_n8n_token', $html );
	}

	public function test_navigation_sanitizes_deep_links_and_renders_all_tasks() {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		wp_set_current_user( $author );
		$malicious   = '"><script>alert(1)</script>';
		$_GET['tab'] = $malicious;

		ob_start();
		lmt_render_page();
		$html = ob_get_clean();

		$this->assertSame( 'home', lmt_sanitize_navigation_tab( $malicious ) );
		$this->assertStringContainsString( 'data-initial-tab="home"', $html );
		$this->assertStringNotContainsString( '<script>alert(1)</script>', $html );
		$this->assertStringContainsString( 'All tasks', $html );
		$this->assertStringContainsString( 'data-goto-tab="alt"', $html );
		$this->assertStringContainsString( 'id="lmt-home-stat-alt"', $html );
	}

	public function test_settings_url_and_appearance_controls_remain_addressable() {
		$admin = self::factory()->user->create( array( 'role' => 'administrator' ) );
		wp_set_current_user( $admin );

		$this->assertStringEndsWith( 'admin.php?page=lookit-media-master&tab=settings', lmt_settings_url() );
		$this->assertSame( 'settings', lmt_sanitize_navigation_tab( 'settings' ) );
		$this->assertSame( '1', lmt_sanitize_checkbox( '1' ) );
		$this->assertSame( '0', lmt_sanitize_checkbox( 'unexpected' ) );

		ob_start();
		lmt_render_settings_panel();
		$html = ob_get_clean();
		$this->assertStringContainsString( 'id="lmt-remember-page"', $html );
		$this->assertStringContainsString( 'id="lmt-fs-opts"', $html );
		$this->assertStringContainsString( 'id="lmt-theme-opts"', $html );
		$this->assertStringContainsString( 'id="lmt-corners-opts"', $html );
	}

	public function test_metabox_registers_only_for_editable_image_and_does_not_save() {
		global $wp_meta_boxes;

		$owner = self::factory()->user->create( array( 'role' => 'author' ) );
		$other = self::factory()->user->create( array( 'role' => 'author' ) );
		$id    = $this->create_image( $owner );
		$post  = get_post( $id );
		wp_set_current_user( $owner );
		$wp_meta_boxes = array();

		do_action( 'add_meta_boxes_attachment', $post );
		$this->assertArrayHasKey( 'lmt_media_master_box', $wp_meta_boxes['attachment']['side']['high'] );

		ob_start();
		lmt_render_attachment_metabox( $post );
		$html = ob_get_clean();
		$this->assertStringContainsString( 'Nothing is saved until you press', $html );
		$this->assertStringNotContainsString( 'name="_wp_attachment_image_alt"', $html );
		$this->assertSame( '', get_post_meta( $id, '_wp_attachment_image_alt', true ) );

		wp_set_current_user( $other );
		$wp_meta_boxes = array();
		do_action( 'add_meta_boxes_attachment', $post );
		$this->assertArrayNotHasKey( 'attachment', $wp_meta_boxes );
	}

	public function test_metabox_assets_enqueue_for_authorized_attachment_screen() {
		$owner = self::factory()->user->create( array( 'role' => 'author' ) );
		$id    = $this->create_image( $owner );
		wp_set_current_user( $owner );
		set_current_screen( 'attachment' );
		$_GET['post'] = $id;

		do_action( 'admin_enqueue_scripts', 'post.php' );

		$this->assertTrue( wp_script_is( 'lmt-metabox', 'enqueued' ) );
		$this->assertTrue( wp_style_is( 'lmt-metabox', 'enqueued' ) );
		$this->assertStringEndsWith( 'assets/metabox.js', wp_scripts()->registered['lmt-metabox']->src );
	}

	public function test_media_menu_absorption_is_optional_and_preserves_third_party_items() {
		global $menu, $submenu;

		$admin = self::factory()->user->create( array( 'role' => 'administrator' ) );
		wp_set_current_user( $admin );
		$media_menu           = array( 'Media', 'upload_files', 'upload.php', '', 'menu-top', 'menu-media', 'dashicons-admin-media' );
		$plugin_menu          = array( 'Media Master', 'upload_files', 'lookit-media-master', '', 'menu-top', 'menu-media-master', 'dashicons-format-image' );
		$media_submenus       = array(
			array( 'Library', 'upload_files', 'upload.php', 'Media Library' ),
			array( 'Add New', 'upload_files', 'media-new.php', 'Add New Media' ),
			array( 'Third Party', 'upload_files', 'third-party-media', 'Third Party Media' ),
		);
		$third_party_callback = static function () {};
		$old_hook             = get_plugin_page_hookname( 'third-party-media', 'upload.php' );
		add_action( $old_hook, $third_party_callback );

		$menu    = array( $media_menu, $plugin_menu );
		$submenu = array(
			'upload.php'          => $media_submenus,
			'lookit-media-master' => array(),
		);
		lmt_absorb_media_menu();
		$this->assertContains( 'upload.php', wp_list_pluck( $menu, 2 ) );
		$this->assertSame( array(), $submenu['lookit-media-master'] );

		update_option( 'lmt_absorb_media_menu', '1' );
		lmt_absorb_media_menu();
		$this->assertNotContains( 'upload.php', wp_list_pluck( $menu, 2 ) );
		$this->assertContains( 'third-party-media', wp_list_pluck( $submenu['lookit-media-master'], 2 ) );
		$new_hook = get_plugin_page_hookname( 'third-party-media', 'lookit-media-master' );
		$this->assertNotFalse( has_action( $new_hook, $third_party_callback ) );

		delete_option( 'lmt_absorb_media_menu' );
		$menu                  = array( $media_menu, $plugin_menu );
		$submenu['upload.php'] = $media_submenus;
		lmt_absorb_media_menu();
		$this->assertContains( 'upload.php', wp_list_pluck( $menu, 2 ) );
		remove_action( $old_hook, $third_party_callback );
		remove_action( $new_hook, $third_party_callback );
	}
}
