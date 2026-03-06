import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { marked, Marked } from 'marked';
import markedResponsiveImages from '../src/index.js';

describe('Marked Responsive Images Extension', () => {
	marked.use(
		markedResponsiveImages({
			sizes: '(max-width: 600px) 100vw, 50vw',
			lazy: true,
		}),
	);

	it('should generate srcset for a valid filename pattern', () => {
		const input = '![Test Image](assets/photo__400-300_800-600.jpg)';
		const output = marked.parse(input);

		assert.match(output, /srcset=".*photo__400-300\.jpg 400w/);
		assert.match(output, /photo__800-600\.jpg 800w/);
	});

	it('should correctly handle format switching (webp)', () => {
		const input = '![WebP](img/pic__800-600-webp.jpg)';
		const output = marked.parse(input);

		assert.match(output, /srcset=".*pic__800-600\.webp 800w/);
		assert.match(output, /src="img\/pic__800-600-webp\.jpg"/);
	});

	it('should inject the sizes attribute provided in options', () => {
		const input = '![Sizes](test__400-400.jpg)';
		const output = marked.parse(input);

		assert.match(output, /sizes="\(max-width: 600px\) 100vw, 50vw"/);
	});

	it('should fallback gracefully (no srcset) when pattern does not match', () => {
		const input = '![Normal](assets/regular-image.jpg)';
		const output = marked.parse(input);

		assert.doesNotMatch(output, /srcset=/);
		assert.match(output, /src="assets\/regular-image\.jpg"/);
	});

	it('should escape unsafe characters in title and alt text', () => {
		const input = '![My "Alt" Text](img__100-100.jpg "My \\"Title\\"")';
		const output = marked.parse(input);

		assert.match(output, /alt="My &quot;Alt&quot; Text"/);
		assert.match(output, /title="My &quot;Title&quot;"/);
	});

	describe('with picture option enabled', () => {
		const markedPic = new Marked();
		markedPic.use(
			markedResponsiveImages({
				sizes: '(max-width: 600px) 100vw, 50vw',
				lazy: true,
				picture: true,
			}),
		);

		it('should generate a <picture> tag with <source> elements grouped by extensions', () => {
			const input =
				'![Picture](img/pic__400-300-webp_400-300-jpg_800-600-webp_800-600-jpg.jpg)';
			const output = markedPic.parse(input);

			assert.match(output, /<picture>/);
			assert.match(
				output,
				/<source srcset=".*pic__400-300\.webp 400w, .*pic__800-600\.webp 800w".*type="image\/webp">/,
			);
			assert.match(
				output,
				/<source srcset=".*pic__400-300\.jpg 400w, .*pic__800-600\.jpg 800w".*type="image\/jpeg">/,
			);
			assert.match(
				output,
				/<img class="md-img" src="img\/pic__400-300-webp_400-300-jpg_800-600-webp_800-600-jpg\.jpg"/,
			);
		});

		it('should sort original extension source to the end', () => {
			const input = '![Picture](img/pic__400-300-png_400-300-webp.png)';
			const output = markedPic.parse(input);

			// Ensure type="image/webp" appears before type="image/png"
			const webpIndex = output.indexOf('type="image/webp"');
			const pngIndex = output.indexOf('type="image/png"');
			assert.ok(webpIndex < pngIndex);
		});

		it('should inject sizes attribute into <source> elements', () => {
			const input = '![Sizes](test__400-400-webp_400-400-jpg.jpg)';
			const output = markedPic.parse(input);

			assert.match(output, /<source.*sizes="\(max-width: 600px\) 100vw, 50vw"/);
		});
	});
});
