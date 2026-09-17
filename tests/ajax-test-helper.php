<?php
/**
 * @package Lookit_Media_Master
 */

trait LMT_Ajax_Test_Helper {

	private function run_ajax( $action, $request = array() ) {
		$_POST    = array_merge(
			array(
				'action' => $action,
				'nonce'  => wp_create_nonce( 'lmt_nonce' ),
			),
			$request
		);
		$_REQUEST = $_POST; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Test request includes a generated nonce.

		$filter = static function () {
			return static function ( $message ) {
				throw new RuntimeException( sanitize_text_field( (string) $message ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Exception text is asserted, not rendered.
			};
		};
		add_filter( 'wp_die_ajax_handler', $filter );

		ob_start();
		try {
			do_action( 'wp_ajax_' . $action );
		} catch ( RuntimeException $exception ) {
			$output = ob_get_clean();
			remove_filter( 'wp_die_ajax_handler', $filter );
			$decoded = json_decode( $output, true );
			return is_array( $decoded ) ? $decoded : array( 'die' => $exception->getMessage() );
		}

		remove_filter( 'wp_die_ajax_handler', $filter );
		$this->fail( 'AJAX action did not terminate.' );
	}
}
