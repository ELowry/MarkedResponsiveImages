import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Marked } from 'marked';
import markedResponsiveImages from '../src/index.js';

describe('Marked Responsive Images Extension', () => {
	// Tests for the default behavior (<picture> mode)
	describe('Default behavior (<picture> mode)', () => {
		const markedPic = new Marked();
		markedPic.use(
			markedResponsiveImages({
				sizes: '(max-width: 600px) 100vw, 50vw',
				lazy: true,
			}),
		);

		it('should generate a <picture> tag with <source> elements grouped by extensions', () => {
			const input = '![Picture](img/pic__400-300-webp_800-600-webp_400-300_800-600.jpg)';
			const output = markedPic.parse(input);

			assert.match(output, /<picture>/);

			// WebP source
			assert.match(
				output,
				/<source srcset="img\/pic__400-300\.webp 400w, img\/pic__800-600\.webp 800w".*type="image\/webp">/,
			);

			// JPEG source (800-600 is the original file, so it uses the raw filename)
			assert.match(
				output,
				/<source srcset="img\/pic__400-300\.jpg 400w, img\/pic__400-300-webp_800-600-webp_400-300_800-600\.jpg 800w".*type="image\/jpeg">/,
			);

			assert.match(
				output,
				/<img src="img\/pic__400-300-webp_800-600-webp_400-300_800-600\.jpg"/,
			);
		});

		it('should sort original extension source to the end', () => {
			const input = '![Picture](img/pic__400-300-webp_400-300.png)';
			const output = markedPic.parse(input);

			// Ensure type="image/webp" appears before type="image/png"
			const webpIndex = output.indexOf('type="image/webp"');
			const pngIndex = output.indexOf('type="image/png"');
			assert.ok(webpIndex !== -1 && pngIndex !== -1, 'Both MIME types should be present');
			assert.ok(webpIndex < pngIndex, 'WebP source should appear before PNG source');
		});

		it('should inject sizes attribute into <source> elements', () => {
			const input = '![Sizes](test__400-400-webp_400-400.jpg)';
			const output = markedPic.parse(input);

			assert.match(output, /<source.*sizes="\(max-width: 600px\) 100vw, 50vw"/);
		});

		it('should fallback gracefully (no picture) when pattern does not match', () => {
			const input = '![Normal](assets/regular-image.jpg)';
			const output = markedPic.parse(input);

			assert.doesNotMatch(output, /<picture>/);
			assert.match(output, /src="assets\/regular-image\.jpg"/);
		});

		it('should escape unsafe characters in title and alt text', () => {
			const input = '![My "Alt" Text](img__100-100.jpg "My \\"Title\\"")';
			const output = markedPic.parse(input);

			assert.match(output, /alt="My &quot;Alt&quot; Text"/);
			assert.match(output, /title="My &quot;Title&quot;"/);
		});

		it('should preserve query parameters and hash fragments', () => {
			const input = '![Params](img/pic__400-300_800-600.jpg?v=123#main)';
			const output = markedPic.parse(input);

			// Check that the generated clean URL keeps the params
			assert.match(output, /img\/pic__400-300\.jpg\?v=123#main 400w/);
			// Check that the raw fallback URL keeps the params
			assert.match(output, /img\/pic__400-300_800-600\.jpg\?v=123#main 800w/);
		});

		it('should handle absolute URLs and root-relative paths correctly', () => {
			// Absolute URL
			const inputAbsolute =
				'![Absolute](https://example.com/assets/pic__400-300_800-600.jpg)';
			const outputAbsolute = markedPic.parse(inputAbsolute);
			assert.match(outputAbsolute, /https:\/\/example\.com\/assets\/pic__400-300\.jpg 400w/);

			// Root-relative URL (leading slash)
			const inputRoot = '![Root](/assets/pic__400-300_800-600.jpg)';
			const outputRoot = markedPic.parse(inputRoot);
			assert.match(outputRoot, /srcset="\/assets\/pic__400-300\.jpg 400w/);
			assert.match(outputRoot, /src="\/assets\/pic__400-300_800-600\.jpg"/);
		});

		it('should omit duplicate variants of the same width and format', () => {
			// Two 400-300 jpgs in the filename
			const input = '![Duplicate](img/pic__400-300_400-300_800-600.jpg)';
			const output = markedPic.parse(input);

			// The srcset should only contain one 400w entry and one 800w entry
			const srcsetMatch = output.match(/srcset="([^"]+)"/);
			const srcset = srcsetMatch[1];

			const parts = srcset.split(',');
			assert.equal(parts.length, 2, 'Should only contain two sizes despite three tokens');
		});

		describe('with lazy option disabled', () => {
			const markedNoLazy = new Marked();
			markedNoLazy.use(
				markedResponsiveImages({
					lazy: false,
				}),
			);

			it('should omit the loading="lazy" attribute', () => {
				const input = '![No Lazy](img/pic__400-300_800-600.jpg)';
				const output = markedNoLazy.parse(input);

				assert.doesNotMatch(output, /loading="lazy"/);
			});
		});
	});

	// Tests for the simple <img> fallback option
	describe('with renderSimpleImgTags option enabled', () => {
		const markedImg = new Marked();
		markedImg.use(
			markedResponsiveImages({
				sizes: '(max-width: 600px) 100vw, 50vw',
				lazy: true,
				renderSimpleImgTags: true,
			}),
		);

		it('should generate standard srcset on a simple <img> tag', () => {
			const input = '![Test Image](assets/photo__400-300_800-600.jpg)';
			const output = markedImg.parse(input);

			assert.doesNotMatch(output, /<picture>/);
			assert.match(output, /<img /);
			// 800-600 is the original file, so it maps to the raw filename
			assert.match(
				output,
				/srcset="assets\/photo__400-300\.jpg 400w, assets\/photo__400-300_800-600\.jpg 800w"/,
			);
			assert.match(output, /sizes="\(max-width: 600px\) 100vw, 50vw"/);
		});

		it('should allow unique sizes of varying formats, but deduplicate identical widths by preferring the original extension', () => {
			// 400-300 is only webp. 800-600 has BOTH webp and jpg.
			const input = '![Mixed](img/pic__400-300-webp_800-600-webp_800-600.jpg)';
			const output = markedImg.parse(input);

			// Should include the 400w webp because it's a unique size
			assert.match(output, /img\/pic__400-300\.webp 400w/);

			// Should include the 800w jpg (original fallback) but omit the 800w webp
			assert.match(output, /img\/pic__400-300-webp_800-600-webp_800-600\.jpg 800w/);
			assert.doesNotMatch(output, /800-600\.webp 800w/);
		});
	});

	// Tests for custom class parameter
	describe('with imageClass option customized', () => {
		it('should use a custom CSS class name', () => {
			const markedCustomClass = new Marked();
			markedCustomClass.use(markedResponsiveImages({ class: 'my-custom-pic' }));
			const output = markedCustomClass.parse('![Alt](img/test__100-100_200-200.jpg)');

			assert.match(output, /class="my-custom-pic"/);
		});

		it('should omit the class attribute entirely if set to an empty string', () => {
			const markedNoClass = new Marked();
			markedNoClass.use(markedResponsiveImages({ class: '' }));
			const output = markedNoClass.parse('![Alt](img/test__100-100_200-200.jpg)');

			assert.doesNotMatch(output, /class=/);
		});

		it('should omit the class attribute entirely if an invalid type is passed', () => {
			const markedInvalidClass = new Marked();
			// Pass a boolean instead of a string
			markedInvalidClass.use(markedResponsiveImages({ class: true }));
			const output = markedInvalidClass.parse('![Alt](img/test__100-100_200-200.jpg)');

			assert.doesNotMatch(output, /class=/);
		});
	});
});
