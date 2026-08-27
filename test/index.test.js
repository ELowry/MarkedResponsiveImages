import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Marked } from 'marked';
import { markedResponsiveImages } from '../src/index.js';

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

		it('should sort <source> elements based on the default format priority order', () => {
			// Testing formats out of order: webp, jpg, avif, jxl
			const input = '![Picture](img/pic__400-300-webp_400-300-avif_400-300-jxl_400-300.jpg)';
			const output = markedPic.parse(input);

			assert.match(output, /<picture>/);

			const jxlIndex = output.indexOf('type="image/jxl"');
			const avifIndex = output.indexOf('type="image/avif"');
			const webpIndex = output.indexOf('type="image/webp"');

			// Assert they exist
			assert.ok(jxlIndex !== -1, 'JXL source missing');
			assert.ok(avifIndex !== -1, 'AVIF source missing');
			assert.ok(webpIndex !== -1, 'WebP source missing');

			// Assert default efficiency priority: jxl -> avif -> webp -> original (jpg fallback)
			assert.ok(jxlIndex < avifIndex, 'JXL should appear before AVIF');
			assert.ok(avifIndex < webpIndex, 'AVIF should appear before WebP');

			// The original JPG will still be parsed as the fallback src inside the <img>
			assert.match(
				output,
				/<img src="img\/pic__400-300-webp_400-300-avif_400-300-jxl_400-300\.jpg"/,
			);
		});

		it('should respect a custom formatPriority array when sorting <source> elements', () => {
			const markedCustomPriority = new Marked();
			markedCustomPriority.use(
				markedResponsiveImages({
					formatPriority: ['webp', 'png', 'avif'], // Custom order prioritizing WebP
				}),
			);

			const input = '![Custom Priority](img/test__400-300-avif_400-300-webp_400-300.png)';
			const output = markedCustomPriority.parse(input);

			const webpIndex = output.indexOf('type="image/webp"');
			const avifIndex = output.indexOf('type="image/avif"');

			// Even though avif comes first in the filename, our custom priority demands webp first
			assert.ok(
				webpIndex < avifIndex,
				'WebP should appear before AVIF due to custom priority',
			);
		});

		it('should assign the correct MIME types for all supported extensions', () => {
			const mimeMap = {
				jxl: 'image/jxl',
				avif: 'image/avif',
				webp: 'image/webp',
				gif: 'image/gif',
				svg: 'image/svg+xml',
				png: 'image/png',
				jpg: 'image/jpeg',
				jpeg: 'image/jpeg',
			};

			for (const [ext, expectedMime] of Object.entries(mimeMap)) {
				const input = `![Mime Test](img/test__400-300-${ext}_800-600.jpg)`;
				const output = markedPic.parse(input);

				assert.match(
					output,
					new RegExp(`type="${expectedMime.replace('+', '\\+')}"`),
					`Failed to map .${ext} to ${expectedMime}`,
				);
			}
		});

		it('should handle pixel density descriptors (e.g., 1x, 2x) instead of width descriptors', () => {
			const input = '![Retina](img/ui__400-300-1x_800-600-2x.png)';
			const output = markedPic.parse(input);

			// Checks that the first source uses "1x" and the final fallback source uses "2x"
			assert.match(
				output,
				/srcset="img\/ui__400-300\.png 1x, img\/ui__400-300-1x_800-600-2x\.png 2x"/,
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
			markedCustomClass.use(markedResponsiveImages({ class: 'custom-image-class' }));
			const output = markedCustomClass.parse('![Alt](img/test__100-100_200-200.jpg)');

			assert.match(output, /class="custom-image-class"/);
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

	// Tests for custom pictureClass parameter
	describe('with pictureClass option customized', () => {
		it('should use a custom CSS class name on the picture tag', () => {
			const markedCustomClass = new Marked();
			markedCustomClass.use(markedResponsiveImages({ pictureClass: 'picture-wrapper' }));
			const output = markedCustomClass.parse('![Alt](img/test__100-100_200-200.jpg)');

			assert.match(output, /<picture class="picture-wrapper">/);
		});
	});

	// Tests for decoding parameter
	describe('with decoding option customized', () => {
		it('should use decoding="auto" by default', () => {
			const markedDefault = new Marked();
			markedDefault.use(markedResponsiveImages());
			const output = markedDefault.parse('![Alt](img/test__100-100_200-200.jpg)');

			assert.match(output, /decoding="auto"/);
		});

		it('should use a custom decoding value', () => {
			const markedCustom = new Marked();
			markedCustom.use(markedResponsiveImages({ decoding: 'async' }));
			const output = markedCustom.parse('![Alt](img/test__100-100_200-200.jpg)');

			assert.match(output, /decoding="async"/);
		});

		it('should omit decoding if set to empty string', () => {
			const markedEmpty = new Marked();
			markedEmpty.use(markedResponsiveImages({ decoding: '' }));
			const output = markedEmpty.parse('![Alt](img/test__100-100_200-200.jpg)');

			assert.doesNotMatch(output, /decoding=/);
		});
	});

	// Tests for auto sizes
	describe('automatic sizes attribute', () => {
		it('should automatically generate sizes based on largest variant width when sizes is omitted', () => {
			const markedAutoSizes = new Marked();
			markedAutoSizes.use(markedResponsiveImages()); // no sizes option provided
			const output = markedAutoSizes.parse('![Alt](img/test__100-100_300-300.jpg)');

			assert.match(output, /sizes="\(max-width: 300px\) 100vw, 300px"/);
		});
	});

	describe('with lazyLoadThreshold option enabled', () => {
		const markedLazyThreshold = new Marked();
		markedLazyThreshold.use(
			markedResponsiveImages({
				// Set threshold to 400.
				// First image adds 300, so it passes.
				// Second image hits when score is > 300, so it fails (lazy loads).
				lazyLoadThreshold: 400,
			}),
		);

		it('should omit loading="lazy" for the first image before the threshold is met', () => {
			const input = '# Title\n\n![First Image](img/pic__100-100_200-200.jpg)';
			const output = markedLazyThreshold.parse(input);

			assert.doesNotMatch(output, /loading="lazy"/);
		});

		it('should apply loading="lazy" to subsequent images after the threshold is exceeded', () => {
			const input =
				'# Title\n\n![First Image](img/pic__100-100_200-200.jpg)\n\n![Second Image](img/pic2__100-100_200-200.jpg)';
			const output = markedLazyThreshold.parse(input);

			// The output should contain exactly one instance of loading="lazy" (on the second image)
			const lazyMatches = output.match(/loading="lazy"/g);
			assert.ok(lazyMatches, 'At least one image should have loading="lazy"');
			assert.equal(lazyMatches.length, 1, 'Exactly one image should be lazy-loaded');
		});

		it('should reset the score on subsequent parse calls', () => {
			// Parse once (exceeds threshold internally)
			markedLazyThreshold.parse('![First](img/pic1__100-100.jpg)\n![Second](img/pic2__100-100.jpg)');

			// Parse a brand new document - the first image should NOT be lazy if the score correctly reset
			const output = markedLazyThreshold.parse('![New First](img/pic3__100-100.jpg)');
			assert.doesNotMatch(output, /loading="lazy"/);
		});
	});
});
