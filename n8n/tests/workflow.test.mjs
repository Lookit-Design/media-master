import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname( fileURLToPath( import.meta.url ) );
const workflow = JSON.parse(
	readFileSync( join( here, '..', 'lookit-media-master-bedrock-vision.json' ), 'utf8' )
);

function codeNode( name, parameters = [] ) {
	const node = workflow.nodes.find( item => item.name === name );
	assert.ok( node, `The workflow has no "${ name }" node.` );
	return new Function( '$input', ...parameters, node.parameters.jsCode );
}

const validate = codeNode( 'Validate request', [ '$env' ] );
const prepare = codeNode( 'Prepare Input' );
const parse = codeNode( 'Parse response' );
const token = 'a'.repeat( 64 );

function input( json ) {
	return { first: () => ( { json } ) };
}

test( 'request validation requires the configured bearer token', () => {
	const accepted = validate(
		input( { headers: { authorization: `Bearer ${ token }` }, body: {} } ),
		{ LMT_MEDIA_MASTER_TOKEN: token }
	)[ 0 ].json;
	const wrong = validate(
		input( { headers: { authorization: `Bearer ${ 'b'.repeat( 64 ) }` }, body: {} } ),
		{ LMT_MEDIA_MASTER_TOKEN: token }
	)[ 0 ].json;
	const missing = validate( input( { headers: {}, body: {} } ), { LMT_MEDIA_MASTER_TOKEN: token } )[ 0 ].json;
	const short = validate(
		input( { headers: { authorization: 'Bearer short' }, body: {} } ),
		{ LMT_MEDIA_MASTER_TOKEN: 'short' }
	)[ 0 ].json;

	assert.equal( accepted.authorised, true );
	assert.equal( wrong.authorised, false );
	assert.equal( missing.authorised, false );
	assert.equal( short.authorised, false );
} );

test( 'request construction strips the data URI and maps its image format', () => {
	const result = prepare(
		input(
			{
				body: {
					image: 'data:image/webp;base64,YWJjZA==',
					mime: 'image/webp',
					prompt: 'Describe this image.',
				},
			}
		)
	)[ 0 ].json.requestBody;

	assert.deepEqual(
		result.messages[ 0 ].content,
		[
			{ image: { format: 'webp', source: { bytes: 'YWJjZA==' } } },
			{ text: 'Describe this image.' },
		]
	);
	assert.deepEqual( result.inferenceConfig, { maxTokens: 600, temperature: 0.2 } );
} );

test( 'response parsing trims the first Bedrock text result', () => {
	const result = parse(
		input(
			{
				output: {
					message: {
						content: [ { text: '  Generated caption.  ' } ],
					},
				},
			}
		)
	)[ 0 ].json;

	assert.deepEqual( result, { text: 'Generated caption.' } );
	assert.deepEqual( parse( input( {} ) )[ 0 ].json, { text: '' } );
} );

test( 'workflow routing rejects unauthorised requests before Bedrock', () => {
	const branches = workflow.connections[ 'Authorised?' ].main;
	assert.deepEqual( branches[ 0 ].map( target => target.node ), [ 'Prepare Input' ] );
	assert.deepEqual( branches[ 1 ].map( target => target.node ), [ 'Respond unauthorised' ] );

	const responder = workflow.nodes.find( item => item.name === 'Respond unauthorised' );
	assert.equal( responder.parameters.options.responseCode, 401 );
} );

test( 'workflow contains no exported credentials and all connections resolve', () => {
	const serialized = JSON.stringify( workflow );
	assert.doesNotMatch( serialized, /AKIA[0-9A-Z]{16}/ );
	assert.doesNotMatch( serialized, /z3qBQY5WLVhX3U9n|Header Auth account 3/ );

	const names = new Set( workflow.nodes.map( item => item.name ) );
	for ( const [ source, outputs ] of Object.entries( workflow.connections ) ) {
		assert.ok( names.has( source ), `Missing source node: ${ source }` );
		for ( const branch of outputs.main ) {
			for ( const target of branch ) {
				assert.ok( names.has( target.node ), `Missing target node: ${ target.node }` );
			}
		}
	}
} );
