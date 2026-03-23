/**
 * A Marked extension class for handling responsive images.
 * Encapsulates parsing logic and configuration for generating responsive image sources.
 *
 * @param {Object} [options={}] - Configuration options.
 * @param {string} [options.sizes=null] - The value used for the image element's sizes attribute.
 * @param {boolean} [options.debug=false] - Whether to log warnings and errors.
 * @param {boolean} [options.lazy=true] - Whether to enable images lazy loading.
 * @param {boolean} [options.renderSimpleImgTags=false] - Whether to generate a simple <img> tag instead of a full <picture> structure.
 * @param {string} [options.class=''] - The class attribute to apply to rendered <img> tags.
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
	 * The class attribute to apply to rendered <img> tags.
	 * @private
	 * @type {string}
	 */
	#class;

	/**
	 * Whether to generate a simple <img> tag instead of a full <picture> structure.
	 * @private
	 * @type {boolean}
	 */
	#renderSimpleImgTags;

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
	 * @param {boolean} [options.class=''] - The class attribute to apply to rendered <img> tags.
	 * @param {boolean} [options.renderSimpleImgTags=false] - Whether to generate a simple <img> tag instead of a full <picture> structure.
	 */
	constructor(options = {}) {
		this.#defaultSizes = options.sizes ?? null;
		this.#debug = options.debug ?? false;
		this.#lazy = options.lazy ?? true;
		this.#renderSimpleImgTags = options.renderSimpleImgTags ?? false;
		this.#class = typeof options.class === 'string' ? options.class.trim() : '';

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
			const sizesAttribute = this.#defaultSizes
				? ` sizes="${this.#stringEscape(this.#defaultSizes)}"`
				: '';
			const titleAttribute = title ? ` title="${this.#stringEscape(title)}"` : '';
			const lazyLoadingAttribute = this.#lazy ? ` loading="lazy"` : '';
			const classes = this.#class ? ` class="${this.#class}"` : '';

			if (this.#renderSimpleImgTags) {
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

				return `<img${classes} src="${href}" srcset="${srcset}"${sizesAttribute} width="${largest.width}" height="${largest.height}" alt="${this.#stringEscape(text) || ''}"${titleAttribute}${lazyLoadingAttribute}>`;
			}

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

			return `<picture>${sourcesHtml}<img${classes} src="${href}" width="${largest.width}" height="${largest.height}" alt="${this.#stringEscape(text) || ''}"${titleAttribute}${lazyLoadingAttribute}></picture>`;
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
		const tokens = sizesPart.split('_');
		return tokens
			.map((token, index) => {
				const parts = token.split('-');
				const width = parseInt(parts[0], 10);
				const height = parseInt(parts[1], 10);
				const extension = parts[2] ? `.${parts[2]}` : originalExtention;
				const isOriginal = index === tokens.length - 1;

				return {
					width: width,
					height: height,
					extension: extension,
					token: `${width}-${height}`,
					isOriginal: isOriginal,
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
		const originalExtensionMatch = filename.match(/(\.[^.]+)$/);
		const originalExtension = originalExtensionMatch ? originalExtensionMatch[1] : '';

		const chosen = new Map();

		for (const variant of variants) {
			const existing = chosen.get(variant.width);

			if (!existing) {
				chosen.set(variant.width, variant);
			} else {
				if (
					existing.extension !== originalExtension
					&& variant.extension === originalExtension
				) {
					chosen.set(variant.width, variant);

					this.#warn(
						`Duplicate width ${variant.width}w found. Preferring original format (${originalExtension}) over (${existing.extension}).`,
					);
				} else if (existing.extension === variant.extension) {
					this.#warn(
						`Duplicate variant omitted: ${base}__${variant.token}${variant.extension}`,
					);
				} else {
					this.#warn(
						`Duplicate width ${variant.width}w omitted: ${base}__${variant.token}${variant.extension}`,
					);
				}
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
					variant.isOriginal,
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
		const originalExtensionMatch = filename.match(/(\.[^.]+)$/);
		const originalExtension = originalExtensionMatch ? originalExtensionMatch[1] : '';

		const byExtension = new Map();

		for (const variant of variants) {
			if (!byExtension.has(variant.extension)) {
				byExtension.set(variant.extension, new Map());
			}

			const existing = byExtension.get(variant.extension).get(variant.width);
			if (existing) {
				this.#warn(
					`Duplicate variant omitted: ${base}__${variant.token}${variant.extension}`,
				);
				continue;
			}
			byExtension.get(variant.extension).set(variant.width, variant);
		}

		const extensions = Array.from(byExtension.keys()).sort((a, b) => {
			if (a === originalExtension) return 1;
			if (b === originalExtension) return -1;
			return 0;
		});

		const sources = [];
		for (const extension of extensions) {
			const extensionVariants = Array.from(byExtension.get(extension).values()).sort(
				(a, b) => a.width - b.width,
			);

			const srcset = extensionVariants
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
						variant.isOriginal,
					);
					return `${finalUrl} ${variant.width}w`;
				})
				.join(', ');

			let typeAttribute = '';
			const cleanExtension = extension.replace('.', '').toLowerCase();
			const mimeType = this.#getMimeType(cleanExtension);
			if (mimeType) {
				typeAttribute = ` type="${mimeType}"`;
			}

			const sizesAttribute = this.#defaultSizes
				? ` sizes="${this.#stringEscape(this.#defaultSizes)}"`
				: '';

			sources.push(`<source srcset="${srcset}"${sizesAttribute}${typeAttribute}>`);
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
		isOriginalFile = false,
	) {
		const variantFilename = isOriginalFile
			? filename
			: `${base}__${variant.token}${variant.extension}`;
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
	 * @param {string} extension - The file extension.
	 * @returns {string} The MIME type, or an empty string if unknown.
	 */
	#getMimeType(extension) {
		const extensionsMap = {
			jpg: 'image/jpeg',
			jpeg: 'image/jpeg',
			png: 'image/png',
			webp: 'image/webp',
			avif: 'image/avif',
			gif: 'image/gif',
			svg: 'image/svg+xml',
		};
		return extensionsMap[extension] || '';
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
 * Encapsulates parsing logic and configuration for generating responsive image sources.
 * Usage: `marked.use(responsiveImages({ /* options *\/ }))`
 *
 * @param {Object} [options={}] - Configuration options.
 * @param {string} [options.sizes=null] - The value used for the image element's sizes attribute.
 * @param {boolean} [options.debug=false] - Whether to log warnings and errors.
 * @param {boolean} [options.lazy=true] - Whether to enable images lazy loading.
 * @param {boolean} [options.renderSimpleImgTags=false] - Whether to generate a simple <img> tag instead of a full <picture> structure.
 * @param {string} [options.class=''] - The class attribute to apply to rendered <img> tags.
 * @returns {Object} Marked extension object (renderer config).
 */
export default function markedResponsiveImages(options = {}) {
	return new MarkedResponsiveImages(options).config;
}
