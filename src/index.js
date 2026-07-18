/**
 * @typedef {Object} ImageVariant
 * @property {number} width - The parsed width of the variant.
 * @property {number} height - The parsed height of the variant.
 * @property {string} extension - The file extension (e.g., '.jpg').
 * @property {string} descriptor - The srcset descriptor (e.g., '400w' or '2x').
 * @property {string} token - The raw size token from the filename.
 * @property {boolean} isOriginal - Whether this variant represents the original file.
 */

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
 * @param {string} [options.pictureClass=''] - The class attribute to apply to the <picture> tag.
 * @param {string} [options.decoding='auto'] - The decoding attribute for the <img> tag.
 * @param {Array<string>} [options.formatPriority=['jxl', 'avif', 'webp', 'png', 'jpeg', 'jpg', 'gif', 'svg']] - The priority order for sorting <source> formats.
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
	 * The class attribute to apply to the <picture> tag.
	 * @private
	 * @type {string}
	 */
	#pictureClass;

	/**
	 * The decoding attribute for the <img> tag.
	 * @private
	 * @type {string}
	 */
	#decoding;

	/**
	 * Whether to generate a simple <img> tag instead of a full <picture> structure.
	 * @private
	 * @type {boolean}
	 */
	#renderSimpleImgTags;

	/**
	 * The priority order for sorting <source> formats.
	 * @private
	 * @type {Array<string>}
	 */
	#formatPriority;

	/**
	 * Regular expression to parse the filename for responsive image metadata.
	 * `^(.*)__` Greedy capture of base name up to the LAST double underscore.
	 * `((?:\d+-\d+(?:-[a-z0-9.]+){0,2})...)` Captures the "sizes" part. Expects 'WIDTH-HEIGHT', 'WIDTH-HEIGHT-EXTENSION', 'WIDTH-HEIGHT-DENSITY', or 'WIDTH-HEIGHT-DENSITY-EXTENSION'.
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
	 * @param {string} [options.class=''] - The class attribute to apply to rendered <img> tags.
	 * @param {string} [options.pictureClass=''] - The class attribute to apply to the <picture> tag.
	 * @param {string} [options.decoding='auto'] - The decoding attribute for the <img> tag.
	 * @param {boolean} [options.renderSimpleImgTags=false] - Whether to generate a simple <img> tag instead of a full <picture> structure.
	 * @param {Array<string>} [options.formatPriority=['jxl', 'avif', 'webp', 'png', 'jpeg', 'jpg', 'gif', 'svg']] - The priority order for sorting <source> formats.
	 */
	constructor(options = {}) {
		this.#defaultSizes = options.sizes ?? null;
		this.#debug = options.debug ?? false;
		this.#lazy = options.lazy ?? true;
		this.#renderSimpleImgTags = options.renderSimpleImgTags ?? false;
		this.#class = typeof options.class === 'string' ? options.class.trim() : '';
		this.#pictureClass =
			typeof options.pictureClass === 'string' ? options.pictureClass.trim() : '';
		this.#decoding = options.decoding ?? 'auto';
		this.#formatPriority = Array.isArray(options.formatPriority)
			? options.formatPriority
			: ['jxl', 'avif', 'webp', 'png', 'jpeg', 'jpg', 'gif', 'svg'];

		this.#regex =
			/^(.*)__((?:\d+-\d+(?:-[a-z0-9.]+){0,2})(?:_(?:\d+-\d+(?:-[a-z0-9.]+){0,2}))*)(\.[^.]+)$/i;
	}

	/**
	 * Returns the extension object required by Marked.
	 *
	 * @returns {Object} The Marked extension object.
	 */
	get config() {
		return {
			name: 'markedResponsiveImages',
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
			const [, base, sizesPart, originalExtension] = match;
			const variants = this.#processVariants(sizesPart, originalExtension);
			const largest = variants[variants.length - 1];

			const sizesValue =
				this.#defaultSizes || `(max-width: ${largest.width}px) 100vw, ${largest.width}px`;
			const sizesAttribute = ` sizes="${this.#stringEscape(sizesValue)}"`;
			const titleAttribute = title ? ` title="${this.#stringEscape(title)}"` : '';
			const lazyLoadingAttribute = this.#lazy ? ` loading="lazy"` : '';
			const decodingAttribute = this.#decoding ? ` decoding="${this.#decoding}"` : '';
			const classes = this.#class ? ` class="${this.#class}"` : '';
			const pictureClasses = this.#pictureClass ? ` class="${this.#pictureClass}"` : '';

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

				return `<img${classes} src="${href}" srcset="${srcset}"${sizesAttribute} width="${largest.width}" height="${largest.height}" alt="${this.#stringEscape(text)}"${titleAttribute}${lazyLoadingAttribute}${decodingAttribute}>`;
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
				sizesAttribute,
			);

			return `<picture${pictureClasses}>${sourcesHtml}<img${classes} src="${href}" width="${largest.width}" height="${largest.height}" alt="${this.#stringEscape(text)}"${titleAttribute}${lazyLoadingAttribute}${decodingAttribute}></picture>`;
		} catch (error) {
			this.#error(`Error generating HTML for ${filename}`, error);
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
	 * @returns {{origin: string, pathname: string, search: string, hash: string, isAbsolute: boolean}|null} The parsed URL components.
	 */
	#parseUrl(href) {
		try {
			const urlObject = new URL(href);
			return {
				origin: urlObject.origin,
				pathname: urlObject.pathname,
				search: urlObject.search,
				hash: urlObject.hash,
				isAbsolute: true,
			};
		} catch {
			try {
				const dummyBaseUrl = 'http://relative-context.invalid';
				const urlWithBase = new URL(href, dummyBaseUrl);
				const isActuallyAbsolute = urlWithBase.origin !== dummyBaseUrl;
				return {
					origin: isActuallyAbsolute ? urlWithBase.origin : '',
					pathname: urlWithBase.pathname,
					search: urlWithBase.search,
					hash: urlWithBase.hash,
					isAbsolute: isActuallyAbsolute,
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
	 * @param {string} originalExtension - The file extension of the original image.
	 * @returns {Array<ImageVariant>} Sorted array of variant objects.
	 */
	#processVariants(sizesPart, originalExtension) {
		const tokens = sizesPart.split('_');
		return tokens
			.map((token, index) => {
				const parts = token.split('-');
				const width = parseInt(parts[0], 10);
				const height = parseInt(parts[1], 10);

				let descriptor = `${width}w`;
				let extension = originalExtension;

				for (let partIndex = 2; partIndex < parts.length; partIndex++) {
					if (/^\d+(?:\.\d+)?x$/i.test(parts[partIndex])) {
						descriptor = parts[partIndex].toLowerCase();
					} else {
						extension = `.${parts[partIndex]}`;
					}
				}

				const isOriginal = index === tokens.length - 1;

				return {
					width: width,
					height: height,
					extension: extension,
					descriptor: descriptor,
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
	 * @param {Array<ImageVariant>} variants - Processed variants.
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
			const existing = chosen.get(variant.descriptor);

			if (!existing) {
				chosen.set(variant.descriptor, variant);
			} else {
				if (
					existing.extension !== originalExtension
					&& variant.extension === originalExtension
				) {
					chosen.set(variant.descriptor, variant);

					this.#warn(
						`Duplicate descriptor ${variant.descriptor} found. Preferring original format (${originalExtension}) over (${existing.extension}).`,
					);
				} else if (existing.extension === variant.extension) {
					this.#warn(
						`Duplicate variant omitted: ${base}__${variant.token}${variant.extension}`,
					);
				} else {
					this.#warn(
						`Duplicate descriptor ${variant.descriptor} omitted: ${base}__${variant.token}${variant.extension}`,
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

				return `${finalUrl} ${variant.descriptor}`;
			})
			.join(', ');
	}

	/**
	 * Generates the <source> tags for a <picture> element.
	 *
	 * @private
	 * @param {Array<ImageVariant>} variants - Processed variants.
	 * @param {string} base - Base filename.
	 * @param {string} pathname - Current pathname.
	 * @param {boolean} isAbsolute - Whether the original URL was absolute.
	 * @param {string} origin - URL origin.
	 * @param {string} search - URL search params.
	 * @param {string} hash - URL hash.
	 * @param {string} originalHref - The raw input href.
	 * @param {string} sizesAttribute - The formatted sizes attribute string.
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
		sizesAttribute,
	) {
		const filename = pathname.split('/').pop();
		const originalExtensionMatch = filename.match(/(\.[^.]+)$/);
		const originalExtension = originalExtensionMatch ? originalExtensionMatch[1] : '';

		const byExtension = new Map();

		for (const variant of variants) {
			if (!byExtension.has(variant.extension)) {
				byExtension.set(variant.extension, new Map());
			}

			const existing = byExtension.get(variant.extension).get(variant.descriptor);
			if (existing) {
				this.#warn(
					`Duplicate variant omitted: ${base}__${variant.token}${variant.extension}`,
				);
				continue;
			}
			byExtension.get(variant.extension).set(variant.descriptor, variant);
		}

		const extensions = Array.from(byExtension.keys()).sort((extensionA, extensionB) => {
			if (extensionA === originalExtension) return 1;
			if (extensionB === originalExtension) return -1;

			const cleanExtensionA = extensionA.replace('.', '').toLowerCase();
			const cleanExtensionB = extensionB.replace('.', '').toLowerCase();

			let priorityIndexA = this.#formatPriority.indexOf(cleanExtensionA);
			let priorityIndexB = this.#formatPriority.indexOf(cleanExtensionB);

			if (priorityIndexA === -1) priorityIndexA = Number.MAX_SAFE_INTEGER;
			if (priorityIndexB === -1) priorityIndexB = Number.MAX_SAFE_INTEGER;

			if (priorityIndexA !== priorityIndexB) {
				return priorityIndexA - priorityIndexB;
			}

			return extensionA.localeCompare(extensionB);
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
					return `${finalUrl} ${variant.descriptor}`;
				})
				.join(', ');

			let typeAttribute = '';
			const cleanExtension = extension.replace('.', '').toLowerCase();
			const mimeType = this.#getMimeType(cleanExtension);
			if (mimeType) {
				typeAttribute = ` type="${mimeType}"`;
			}

			sources.push(`<source srcset="${srcset}"${sizesAttribute}${typeAttribute}>`);
		}

		return sources.join('');
	}

	/**
	 * Builds the final URL for a given variant.
	 *
	 * @private
	 * @param {ImageVariant} variant - The variant object.
	 * @param {string} base - Base filename.
	 * @param {string} pathname - Current pathname.
	 * @param {string} filename - Original filename.
	 * @param {boolean} isAbsolute - Whether the original URL was absolute.
	 * @param {string} origin - URL origin.
	 * @param {string} search - URL search params.
	 * @param {string} hash - URL hash.
	 * @param {string} originalHref - The raw input href.
	 * @param {boolean} isOriginalFile - Whether this is the original file.
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
			jxl: 'image/jxl',
		};
		return extensionsMap[extension] || '';
	}

	/**
	 * Logs a warning to the console if debug mode is enabled.
	 *
	 * @private
	 * @param {string} message - The warning message to log.
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
	 * @param {string} message - The error message to log.
	 * @param {Error|null} [context=null] - Optional additional context to log with the error.
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
 * @param {string} [options.pictureClass=''] - The class attribute to apply to the <picture> tag.
 * @param {string} [options.decoding='auto'] - The decoding attribute for the <img> tag.
 * @param {Array<string>} [options.formatPriority=['jxl', 'avif', 'webp', 'png', 'jpeg', 'jpg', 'gif', 'svg']] - The priority order for sorting <source> formats.
 * @returns {Object} Marked extension object (renderer config).
 */
export function markedResponsiveImages(options = {}) {
	return new MarkedResponsiveImages(options).config;
}
