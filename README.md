# [Marked Responsive Images](https://github.com/ELowry/MarkedResponsiveImages)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github)](https://github.com/ELowry/MarkedResponsiveImages)
[![npm](https://img.shields.io/npm/v/marked-responsive-images?logo=npm)](https://www.npmjs.com/package/marked-responsive-images)

An extension for [Marked](https://marked.js.org/) ([github](https://github.com/markedjs/marked), [npm](https://www.npmjs.com/package/marked)) designed to generate responsive images by parsing simple filename conventions into full `<picture>` elements with `srcset` and `sizes` attributes based on simple filename conventions.

**Marked Responsive Images** parses image filenames to detect available size and file extension variants without breaking standard markdown compatibility.

## Installation

```bash
npm install marked-responsive-images
```

## Usage

```javascript
// Default factory export (recommended)
import { marked } from 'marked';
import { markedResponsiveImages } from 'marked-responsive-images';

/*
// or use UMD scripts
<script src="https://cdn.jsdelivr.net/npm/marked/lib/marked.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/marked-responsive-images/dist/index.umd.js"></script>
*/

// Register with marked
marked.use(markedResponsiveImages());

// Render markdown
const html = marked.parse('![My Image](assets/hero__400-300_800-600.jpg)');
```

## Naming Convention

### Naming the Main File

The extension looks for a specific pattern at the end of your filenames to generate the `<source>` tags and/or `srcset` attribute.

**Pattern:** `filename__width-height_width-height-extension[…]_currentFileWidth-currentFileHeight.png`

1. **Separator:**  
   Use two underscores (`__`) to separate the base name from the sizes.
2. **Variants:**  
   Use one underscore (`_`) to separate different size variants.
3. **Dimensions:**  
   Use a dash (`-`) to separate width and height.
4. **[*optional*] Extension:**  
   Use a second dash (`-`) to specify a file extension if it is different from the one used by the URL.

> [!NOTE]  
> **The "full name" image must exist on your server.**  
> The image path you write in Markdown (e.g., `hero__400-300_800-600.jpg`) is used as the **graceful fallback**. This raw filename is assigned to the `src` attribute of the inner `<img>` tag and will be the only image loaded if the extension is disabled or if the Markdown is viewed in an environment that doesn't support responsive images.

> [!IMPORTANT]  
> **This extension does not resize images.**  
> It is your responsibility to ensure that all physical image files—both the "Full Name" fallback and the individual variants (e.g., `hero__400-300.jpg`)—actually exist at the destination. This extension only generates the HTML markup to point to them.

### Examples

#### Basic Resizing:

- **Markdown:**
    ```md
    ![Responsive image example](img/photo__400-300_800-600.jpg)
    ```
- **Resulting HTML:**
    ```html
    <picture>
    	<source
    		srcset="img/photo__400-300.jpg 400w, img/photo__800-600.jpg 800w"
    		type="image/jpeg"
    	/>
    	<img
    		src="img/photo__400-300_800-600.jpg"
    		width="800"
    		height="600"
    		alt="Responsive image example"
    	/>
    </picture>
    ```

#### Format Switching:

- **Markdown:**
    ```md
    ![Web optimized photo example](img/photo__800-600-webp_800-600.jpg)
    ```
- **Resulting HTML:**
    ```html
    <picture>
    	<source srcset="img/photo__800-600.webp 800w" type="image/webp" />
    	<source srcset="img/photo__800-600.jpg 800w" type="image/jpeg" />
    	<img
    		src="img/photo__800-600-webp_800-600.jpg"
    		width="800"
    		height="600"
    		alt="Web optimized photo example"
    	/>
    </picture>
    ```

## Configuration

You can configure global options for **Marked Responsive Images** using:

```js
marked.use(
	markedResponsiveImages({
		sizes: null, // {string}
		lazy: true, // {boolean}
		debug: false, // {boolean}
		class: '', // {string}
		renderSimpleImgTags: false, // {boolean}
	}),
);
```

| Option                | Type      | Default | Description                                                                                                                                                                                                                              |
| :-------------------- | :-------- | :------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sizes`               | `string`  | `null`  | The `sizes` attribute that should be added to generate `<source>` or `<img>` tags.                                                                                                                                                       |
| `lazy`                | `boolean` | `true`  | Adds `loading="lazy"` to images for better page load optimization.                                                                                                                                                                       |
| `debug`               | `boolean` | `false` | Log warnings to the console when URLs cannot be parsed or formats are malformed.                                                                                                                                                         |
| `class`               | `string`  | `''`    | The class attribute to apply to rendered `<img>` tags.                                                                                                                                                                                   |
| `renderSimpleImgTags` | `boolean` | `false` | Enable to generate a simple `<img>` tag with a `srcset` attribute instead of a full `<picture>` element.<br/>_When enabled, format variations are automatically stripped out, as standard <img> tags do not support format negotiation._ |
