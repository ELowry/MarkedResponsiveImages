import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { marked } from 'marked';
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
});
