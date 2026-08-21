# Marked Responsive Images

[![License: MIT](https://img.shields.io/badge/License-MIT-3d383b.svg)](LICENSE) [![Latest GitHub release](https://img.shields.io/github/v/release/ELowry/MarkedResponsiveImages?logo=GitHub&color=a4785e)](https://github.com/ELowry/MarkedResponsiveImages/releases/latest) [![npm](https://img.shields.io/npm/v/marked-responsive-images?logo=npm&color=e29186)](https://www.npmjs.com/package/marked-responsive-images)

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

> [!TIP]  
> I have written a [PowerShell automation script](https://gist.github.com/ELowry/0fa9fe7d0597fc321b06b83a2954e605) to automatically generate image size variants, WebP alternatives, and output a fully formed Markedown image link.

### Naming the Main File

The extension looks for a specific pattern at the end of your filenames to generate the `<source>` tags and/or `srcset` attribute.

**Pattern:** `filename__width-height[-density][-extension]_[…]_currentFileWidth-currentFileHeight.png`

1. **Separator:**  
   Use two underscores (`__`) to separate the base name from the sizes.
2. **Variants:**  
   Use one underscore (`_`) to separate different size variants.
3. **Dimensions:**  
   Use a dash (`-`) to separate width and height.
4. **[_optional_] Density:**  
   Use a dash (`-`) followed by a pixel density multiplier (e.g., `1x`, `1.5x`, `2x`) to instruct the browser to use display density rather than viewport width.
5. **[_optional_] Extension:**  
   Use a dash (`-`) to specify a file extension if it is different from the one used by the URL.
    - Supported formats: `jpg`, `jpeg`, `png`, `webp`, `avif`, `gif`, `svg`, `jxl`.

> [!NOTE]  
> **The "full name" image must exist on your server.**  
> The image path you write in Markdown (e.g., `hero__400-300_800-600.jpg`) is used as the **graceful fallback**. This raw filename is assigned to the `src` attribute of the inner `<img>` tag and will be the only image loaded if the extension is disabled or if the Markdown is viewed in an environment that doesn't support responsive images.

> [!NOTE]  
> **Format Ordering:**  
> When multiple formats of the same size are provided, the extension automatically sorts the generated `<source>` tags based on the `formatPriority` configuration array (defaulting to the most modern/efficient formats first, like JXL and AVIF). The physical order of the tokens in the filename does not matter.

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

#### Pixel Density (Retina Displays):

- **Markdown:**
    ```md
    ![App screenshot](img/ui__400-300-1x_800-600-2x.png)
    ```
- **Resulting HTML:**
    ```html
    <picture>
    	<source srcset="img/ui__400-300.png 1x, img/ui__800-600.png 2x" type="image/png" />
    	<img
    		src="img/ui__400-300-1x_800-600-2x.png"
    		width="800"
    		height="600"
    		alt="App screenshot"
    	/>
    </picture>
    ```

## Configuration

You can configure global options for **Marked Responsive Images** using:

```js
marked.use(
	markedResponsiveImages({
		sizes: null, // {string}
		class: '', // {string}
		pictureClass: '', // {string}
		debug: false, // {boolean}
		lazy: true, // {boolean}
		decoding: 'auto', // {'async' | 'sync' | 'auto'}
		renderSimpleImgTags: false, // {boolean}
		formatPriority: ['jxl', 'avif', 'webp', 'png', 'jpeg', 'jpg', 'gif', 'svg'], // {Array<string>}
	}),
);
```

<!-- prettier-ignore -->
<table>
	<thead>
		<tr>
			<th>Option</th>
			<th>Type</th>
			<th>Default</th>
			<th>Description</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td>
				<p><code>sizes</code></p>
			</td>
			<td>
				<p><code>string</code></p>
			</td>
			<td>
				<p><code>null</code></p>
			</td>
			<td>
				<p>The <code>sizes</code> attribute that should be added to <code>&lt;source&gt;</code> or <code>&lt;img&gt;</code> tags. If empty, an automatic default is set based on the largest variant width.</p>
			</td>
		</tr>
		<tr>
			<td>
				<p><code>class</code></p>
			</td>
			<td>
				<p><code>string</code></p>
			</td>
			<td>
				<p><code>''</code></p>
			</td>
			<td>
				<p>The class attribute to apply to rendered <code>&lt;img&gt;</code> tags.</p>
			</td>
		</tr>
		<tr>
			<td>
				<p><code>pictureClass</code></p>
			</td>
			<td>
				<p><code>string</code></p>
			</td>
			<td>
				<p><code>''</code></p>
			</td>
			<td>
				<p>The class attribute to apply to the <code>&lt;picture&gt;</code> wrapper tag.</p>
			</td>
		</tr>
		<tr>
			<td>
				<p><code>lazy</code></p>
			</td>
			<td>
				<p><code>boolean</code></p>
			</td>
			<td>
				<p><code>true</code></p>
			</td>
			<td>
				<p>
					Adds <a href="https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/loading" target="_blank" rel="noopener noreferrer"><code>loading="lazy"</code></a> to images for better page load optimization.
				</p>
			</td>
		</tr>
		<tr>
			<td>
				<p><code>decoding</code></p>
			</td>
			<td>
				<p><code>string</code></p>
			</td>
			<td>
				<p><code>'auto'</code></p>
			</td>
			<td>
				<p>
					The <a href="https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decoding" target="_blank" rel="noopener noreferrer"><code>decoding</code></a> attribute strategy to apply to the <code>&lt;img&gt;</code> tag.
				</p>
			</td>
		</tr>
		<tr>
			<td>
				<p><code>debug</code></p>
			</td>
			<td>
				<p><code>boolean</code></p>
			</td>
			<td>
				<p><code>false</code></p>
			</td>
			<td>Log warnings to the console when URLs cannot be parsed or formats are malformed.</td>
		</tr>
		<tr>
			<td>
				<p><code>renderSimpleImgTags</code></p>
			</td>
			<td>
				<p><code>boolean</code></p>
			</td>
			<td>
				<p><code>false</code></p>
			</td>
			<td>
				<p>Enable to generate a simple <code>&lt;img&gt;</code> tag with a <code>srcset</code> attribute instead of a full <code>&lt;picture&gt;</code> element.</p>
				<p>
					<em>When enabled, format variations are automatically stripped out, as standard <code>&lt;img&gt;</code> tags do not support format negotiation.</em>
				</p>
			</td>
		</tr>
		<tr>
			<td>
				<p><code>formatPriority</code></p>
			</td>
			<td>
				<p><code>Array&lt;string&gt;</code></p>
			</td>
			<td>
				<pre><code>['jxl',
'avif',
'webp',
'png',
'jpeg',
'jpg',
'gif',
'svg'];
</code></pre>
			</td>
			<td>
				<p>Defines the sorting priority for <code>&lt;source&gt;</code> formats. The default is ordered based on typical efficiency.</p>
			</td>
		</tr>
	</tbody>
</table>

<!-- prettier-ignore end -->
