/**
 * A Marked extension class for handling responsive images.
 * Encapsulates parsing logic and configuration for generating srcset attributes.
 *
 * @param {Object} [options={}] - Configuration options.
 * @param {string} [options.sizes=null] - The value used for the image element's sizes attribute.
 * @param {boolean} [options.debug=false] - Whether to log warnings and errors.
 * @param {boolean} [options.lazy=true] - Whether to enable images lazy loading.
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
	 */
	constructor(options = {}) {
		this.#defaultSizes = options.sizes || null;
		this.#debug = options.debug || false;
		this.#lazy = options.lazy || true;

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
			const largest = variants[variants.length - 1];
			const sizesAttr = this.#defaultSizes ? ` sizes="${this.#defaultSizes}"` : '';
			const titleAttr = title ? ` title="${title}"` : '';
			const lazyLoadingAttr = this.#lazy ? ` loading="lazy"` : '';

			return `<img class="md-img" src="${href}" srcset="${srcset}"${sizesAttr} width="${largest.width}" height="${largest.height}" alt="${text || ''}"${titleAttr}${lazyLoadingAttr}>`;
		} catch (e) {
			this.#error(`Error generating HTML for ${filename}`, e);
			return false;
		}
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

		return variants
			.map((variant) => {
				const variantFilename = `${base}__${variant.token}${variant.ext}`;
				const variantPathname = pathname.replace(filename, variantFilename);
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

				return `${finalUrl} ${variant.width}w`;
			})
			.join(', ');
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
 * @returns {Object} Marked extension object (renderer config).
 */
export default function responsiveImages(options = {}) {
	return new MarkedResponsiveImages(options).config;
}
