/**
 * A Marked extension class for handling responsive images.
 * Encapsulates parsing logic and configuration for generating srcset attributes.
 *
 * @param {Object} [options={}] - Configuration options.
 * @param {string} [options.sizes=null] - The value used for the image element's sizes attribute.
 * @param {boolean} [options.debug=false] - Whether to log warnings and errors.
 * @param {boolean} [options.lazy=true] - Whether to enable images lazy loading.
 * @param {boolean} [options.picture=false] - Whether to generate a <picture> tag instead of an <img> tag.
 */
class MarkedResponsiveImages {
	/**
	 * The value used for the image element's sizes attribute.
	 * @private
	 * @type {string}
	 */
	#defaultSizes;

	/**
	 * Whether to log warnings and errors to the console.
	 * @private
	 * @type {boolean}
	 */
	#debug;

	/**
	 * Whether to enable lazy loading for images.
	 * @private
	 * @type {boolean}
	 */
	#lazy;

	/**
	 * Whether to generate a <picture> tag instead of an <img> tag.
	 * @private
	 * @type {boolean}
	 */
	#picture;

	/**
	 * Regular expression to parse the filename for responsive image metadata.
	 * `^(.*)__` Greedy capture of base name up to the LAST double underscore.
	 * `((?:\d+-\d+(?:-[a-z0-9]+)?)...)` Captures the "sizes" part. Expects 'W-H' or 'W-H-EXT'.
	 * `(\.[^.]+)$` Captures the file extension.
	 * @private
	 * @type {RegExp}
	 */
	#regex;

	/**
	 * Creates an instance of the MarkedResponsiveImages.
	 *
	 * @param {Object} [options={}] - Configuration options.
	 * @param {string} [options.sizes=null] - The value used for the image element's sizes attribute.
	 * @param {boolean} [options.debug=false] - Whether to log warnings and errors.
	 * @param {boolean} [options.lazy=true] - Whether to enable images lazy loading.
	 * @param {boolean} [options.picture=false] - Whether to generate a <picture> tag instead of an <img> tag.
	 */
	constructor(options = {}) {
		this.#defaultSizes = options.sizes ?? null;
		this.#debug = options.debug ?? false;
		this.#lazy = options.lazy ?? true;
		this.#picture = options.picture ?? false;

		this.#regex =
			/^(.*)__((?:\d+-\d+(?:-[a-z0-9]+)?)(?:_(?:\d+-\d+(?:-[a-z0-9]+)?))*)(\.[^.]+)$/i;
	}

	/**
	 * Returns the extension object required by Marked.
	 *
	 * @returns {Object} The Marked extension object.
	 */
	get config() {
		return {
			name: 'responsiveImage',
			renderer: {
				image: (token) => this.#render(token),
			},
		};
	}

	/**
	 * Internal render logic for the image token.
	 *
	 * @private
	 * @param {Object} token - The marked token.
	 * @returns {string|boolean} The rendered HTML or false to fallback.
	 */
	#render(token) {
		const { href, title, text } = token;
		const parsedUrl = this.#parseUrl(href);

		if (!parsedUrl) {
			this.#warn(`Could not parse URL: ${href}`);
			return false;
		}

		const { pathname, isAbsolute, origin, search, hash } = parsedUrl;
		const filename = pathname.split('/').pop();
		const match = filename.match(this.#regex);

		if (!match) {
			if (filename.includes('__')) {
				this.#warn(
					`Filename contains '__' but does not match expected pattern: ${filename}`,
				);
			}
			return false;
		}

		try {
			const [, base, sizesPart, originalExtention] = match;
			const variants = this.#processVariants(sizesPart, originalExtention);
			const largest = variants[variants.length - 1];
			const sizesAttr = this.#defaultSizes
				? ` sizes="${this.#stringEscape(this.#defaultSizes)}"`
				: '';
			const titleAttr = title ? ` title="${this.#stringEscape(title)}"` : '';
			const lazyLoadingAttr = this.#lazy ? ` loading="lazy"` : '';

			if (this.#picture) {
				const sourcesHtml = this.#generatePictureSources(
					variants,
					base,
					pathname,
					isAbsolute,
					origin,
					search,
					hash,
					href,
				);
				return `<picture>${sourcesHtml}<img class="md-img" src="${href}" width="${largest.width}" height="${largest.height}" alt="${this.#stringEscape(text) || ''}"${titleAttr}${lazyLoadingAttr}></picture>`;
			}

			const srcset = this.#generateSrcset(
				variants,
				base,
				pathname,
				isAbsolute,
				origin,
				search,
				hash,
				href,
			);

			return `<img class="md-img" src="${href}" srcset="${srcset}"${sizesAttr} width="${largest.width}" height="${largest.height}" alt="${this.#stringEscape(text) || ''}"${titleAttr}${lazyLoadingAttr}>`;
		} catch (e) {
			this.#error(`Error generating HTML for ${filename}`, e);
			return false;
		}
	}

	/**
	 * Escapes double quotes in a string for safe HTML attribute usage.
	 * @private
	 * @param {string} string - The string to escape.
	 * @returns {string} The escaped string.
	 */
	#stringEscape(string) {
		return (string || '').replace(/"/g, '&quot;');
	}

	/**
	 * Parses a URL string handling absolute and relative paths.
	 *
	 * @private
	 * @param {string} href - The URL to parse.
	 * @returns {Object|null} The parsed URL components.
	 */
	#parseUrl(href) {
		try {
			const urlObj = new URL(href);
			return {
				origin: urlObj.origin,
				pathname: urlObj.pathname,
				search: urlObj.search,
				hash: urlObj.hash,
				isAbsolute: true,
			};
		} catch {
			try {
				const base = 'http://u';
				const urlObj = new URL(href, base);
				return {
					origin: '',
					pathname: urlObj.pathname,
					search: urlObj.search,
					hash: urlObj.hash,
					isAbsolute: false,
				};
			} catch {
				return null;
			}
		}
	}

	/**
	 * Processes the size string into usable variant objects.
	 *
	 * @private
	 * @param {string} sizesPart - The string containing size definitions.
	 * @param {string} originalExtention - The file extension of the original image.
	 * @returns {Array<Object>} Sorted array of variant objects.
	 */
	#processVariants(sizesPart, originalExtention) {
		return sizesPart
			.split('_')
			.map((token) => {
				const parts = token.split('-');
				const width = parseInt(parts[0], 10);
				const height = parseInt(parts[1], 10);
				const ext = parts[2] ? `.${parts[2]}` : originalExtention;

				return {
					width: width,
					height: height,
					ext: ext,
					token: `${width}-${height}`,
				};
			})
			.sort((a, b) => a.width - b.width);
	}

	/**
	 * Generates the srcset string.
	 *
	 * @private
	 * @param {Array<Object>} variants - Processed variants.
	 * @param {string} base - Base filename.
	 * @param {string} pathname - Current pathname.
	 * @param {boolean} isAbsolute - Whether the original URL was absolute.
	 * @param {string} origin - URL origin.
	 * @param {string} search - URL search params.
	 * @param {string} hash - URL hash.
	 * @param {string} originalHref - The raw input href for slash detection.
	 * @returns {string} The formatted srcset.
	 */
	#generateSrcset(variants, base, pathname, isAbsolute, origin, search, hash, originalHref) {
		const filename = pathname.split('/').pop();
		const originalExtMatch = filename.match(/(\.[^.]+)$/);
		const originalExt = originalExtMatch ? originalExtMatch[1] : '';

		// Deduplicate variants by width, preferring a non-original extension
		const chosen = new Map();

		for (const variant of variants) {
			const existing = chosen.get(variant.width);
			if (!existing) {
				chosen.set(variant.width, variant);
				continue;
			}

			if (existing.ext === variant.ext) {
				this.#warn(`Duplicate variant omitted: ${base}__${variant.token}${variant.ext}`);
				continue;
			}

			const existingIsDefault = existing.ext === originalExt;
			const variantIsDefault = variant.ext === originalExt;

			if (existingIsDefault && !variantIsDefault) {
				chosen.set(variant.width, variant);
				continue;
			}

			if (!existingIsDefault && variantIsDefault) {
				continue;
			}
		}

		const prunedVariants = Array.from(chosen.values()).sort((a, b) => a.width - b.width);

		return prunedVariants
			.map((variant) => {
				const finalUrl = this.#buildVariantUrl(
					variant,
					base,
					pathname,
					filename,
					isAbsolute,
					origin,
					search,
					hash,
					originalHref,
				);

				return `${finalUrl} ${variant.width}w`;
			})
			.join(', ');
	}

	/**
	 * Generates the <source> tags for a <picture> element.
	 *
	 * @private
	 * @param {Array<Object>} variants - Processed variants.
	 * @param {string} base - Base filename.
	 * @param {string} pathname - Current pathname.
	 * @param {boolean} isAbsolute - Whether the original URL was absolute.
	 * @param {string} origin - URL origin.
	 * @param {string} search - URL search params.
	 * @param {string} hash - URL hash.
	 * @param {string} originalHref - The raw input href.
	 * @returns {string} The HTML <source> tags.
	 */
	#generatePictureSources(
		variants,
		base,
		pathname,
		isAbsolute,
		origin,
		search,
		hash,
		originalHref,
	) {
		const filename = pathname.split('/').pop();
		const originalExtMatch = filename.match(/(\.[^.]+)$/);
		const originalExt = originalExtMatch ? originalExtMatch[1] : '';

		const byExt = new Map();

		for (const variant of variants) {
			if (!byExt.has(variant.ext)) {
				byExt.set(variant.ext, new Map());
			}

			const existing = byExt.get(variant.ext).get(variant.width);
			if (existing) {
				this.#warn(`Duplicate variant omitted: ${base}__${variant.token}${variant.ext}`);
				continue;
			}
			byExt.get(variant.ext).set(variant.width, variant);
		}

		const extensions = Array.from(byExt.keys()).sort((a, b) => {
			if (a === originalExt) return 1;
			if (b === originalExt) return -1;
			return 0;
		});

		const sources = [];
		for (const ext of extensions) {
			const extVariants = Array.from(byExt.get(ext).values()).sort(
				(a, b) => a.width - b.width,
			);

			const srcset = extVariants
				.map((variant) => {
					const finalUrl = this.#buildVariantUrl(
						variant,
						base,
						pathname,
						filename,
						isAbsolute,
						origin,
						search,
						hash,
						originalHref,
					);
					return `${finalUrl} ${variant.width}w`;
				})
				.join(', ');

			let typeAttr = '';
			const cleanExt = ext.replace('.', '').toLowerCase();
			const mimeType = this.#getMimeType(cleanExt);
			if (mimeType) {
				typeAttr = ` type="${mimeType}"`;
			}

			const sizesAttr = this.#defaultSizes
				? ` sizes="${this.#stringEscape(this.#defaultSizes)}"`
				: '';

			sources.push(`<source srcset="${srcset}"${sizesAttr}${typeAttr}>`);
		}

		return sources.join('');
	}

	/**
	 * Builds the final URL for a given variant.
	 *
	 * @private
	 * @param {Object} variant - The variant object.
	 * @param {string} base - Base filename.
	 * @param {string} pathname - Current pathname.
	 * @param {string} filename - Original filename.
	 * @param {boolean} isAbsolute - Whether the original URL was absolute.
	 * @param {string} origin - URL origin.
	 * @param {string} search - URL search params.
	 * @param {string} hash - URL hash.
	 * @param {string} originalHref - The raw input href.
	 * @returns {string} The final URL.
	 */
	#buildVariantUrl(
		variant,
		base,
		pathname,
		filename,
		isAbsolute,
		origin,
		search,
		hash,
		originalHref,
	) {
		const variantFilename = `${base}__${variant.token}${variant.ext}`;
		const variantPathname =
			pathname.substring(0, pathname.length - filename.length) + variantFilename;
		let finalUrl;

		if (isAbsolute) {
			finalUrl = `${origin}${variantPathname}${search}${hash}`;
		} else {
			const hadLeadingSlash = originalHref.startsWith('/');
			const cleanPath =
				variantPathname.startsWith('/') && !hadLeadingSlash
					? variantPathname.slice(1)
					: variantPathname;
			finalUrl = `${cleanPath}${search}${hash}`;
		}

		return finalUrl;
	}

	/**
	 * Returns the MIME type for a given file extension.
	 *
	 * @private
	 * @param {string} ext - The file extension.
	 * @returns {string} The MIME type, or an empty string if unknown.
	 */
	#getMimeType(ext) {
		const map = {
			jpg: 'image/jpeg',
			jpeg: 'image/jpeg',
			png: 'image/png',
			webp: 'image/webp',
			avif: 'image/avif',
			gif: 'image/gif',
			svg: 'image/svg+xml',
		};
		return map[ext] || '';
	}

	/**
	 * Logs a warning to the console if debug mode is enabled.
	 *
	 * @private
	 * @param message The warning message to log.
	 */
	#warn(message) {
		if (this.#debug) {
			console.warn(`[Marked Responsive Images] ${message}`);
		}
	}

	/**
	 * Logs an error to the console if debug mode is enabled.
	 *
	 * @private
	 * @param message The error message to log.
	 * @param context Optional additional context to log with the error.
	 */
	#error(message, context = null) {
		if (this.#debug) {
			if (context) {
				console.error(`[Marked Responsive Images] ${message}`, context);
			} else {
				console.error(`[Marked Responsive Images] ${message}`);
			}
		}
	}
}

/**
 * A Marked extension class for handling responsive images.
 * Encapsulates parsing logic and configuration for generating srcset attributes.
 * Usage: `marked.use(responsiveImages({ /* options *\/ }))`
 *
 * @param {Object} [options={}] - Configuration options.
 * @param {string} [options.sizes=null] - The value used for the image element's sizes attribute.
 * @param {boolean} [options.debug=false] - Whether to log warnings and errors.
 * @param {boolean} [options.lazy=true] - Whether to enable images lazy loading.
 * @param {boolean} [options.picture=false] - Whether to generate a <picture> tag instead of an <img> tag.
 * @returns {Object} Marked extension object (renderer config).
 */
export default function markedResponsiveImages(options = {}) {
	return new MarkedResponsiveImages(options).config;
}
