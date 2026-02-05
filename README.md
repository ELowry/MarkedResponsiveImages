[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

# marked-responsive-images

A robust [Marked](https://marked.js.org/) extension that automatically generates `srcset` and `sizes` attributes for images based on filename conventions. It parses your image filenames to detect available size variants and format conversions (like WebP), keeping your Markdown clean and portable.

## Features

- **Convention over Configuration:** Encodes image metadata directly in filenames.
- **Environment Agnostic:** Works in the Browser, Node.js, and Static Site Generators.
- **Performance First:** Automatically adds `width`, `height`, and `loading="lazy"` to prevent Layout Shift (CLS).
- **Format Switching:** Supports variants with different file extensions (e.g., serving a `.webp` variant for a `.jpg` original).

## Installation

```bash
npm install marked-responsive-images
```

## Usage

### ES Modules (Node.js / Bundlers)

```javascript
import { marked } from 'marked';
import { MarkedResponsiveImages } from 'marked-responsive-images';

// Initialize the extension
const responsive = new MarkedResponsiveImages({
	sizes: '(max-width: 768px) 100vw, 800px', // Optional: Global sizes attribute
	debug: false, // Optional: Enable console warnings
});

// Register with marked
marked.use(responsive.config);

// Render markdown
const html = marked.parse('![My Image](assets/hero__400-300_800-600.jpg)');
```

### Browser (CDN)

```html
<script src="https://cdn.jsdelivr.net/npm/marked/lib/marked.umd.js"></script>
<script src="https://unpkg.com/marked-responsive-images"></script>

<script>
	const responsive = new markedResponsiveImages.MarkedResponsiveImages();
	marked.use(responsive.config);

	document.getElementById('content').innerHTML = marked.parse('...');
</script>
```

## Naming Convention

The extension looks for a specific pattern at the end of your filenames to generate the `srcset`.

**Pattern:** `filename__WIDTH-HEIGHT[-EXT]_WIDTH-HEIGHT[-EXT]... .ext`

1.  **Separator:** Use `__` (double underscore) to separate the base name from the sizes.
2.  **Variants:** Use `_` (underscore) to separate different size variants.
3.  **Dimensions:** Use `-` (dash) to separate width and height.
4.  **Extension (Optional):** Add a third segment to the dimension token to specify a different format.

### Examples

**Basic Resizing:**
Markdown: `![Alt](img/photo__400-300_800-600.jpg)`

- **Source:** `img/photo__400-300_800-600.jpg` (800w)
- **Srcset:**
    - `img/photo__400-300.jpg` (400w)
    - `img/photo__400-300_800-600.jpg` (800w)

**Format Switching (WebP):**
Markdown: `![Alt](img/photo__800-600-webp.jpg)`

- **Source:** `img/photo__800-600-webp.jpg` (Original fallback)
- **Srcset:**
    - `img/photo__800-600-webp.webp` (800w) - _Note the extension change_

## Configuration

| Option  | Type      | Default | Description                                                                      |
| :------ | :-------- | :------ | :------------------------------------------------------------------------------- |
| `sizes` | `string`  | `null`  | The `sizes` attribute added to the `<img>` tag.                                  |
| `lazy`  | `boolean` | `true`  | Adds `loading="lazy"` to images.                                                 |
| `debug` | `boolean` | `false` | Log warnings to the console when URLs cannot be parsed or formats are malformed. |