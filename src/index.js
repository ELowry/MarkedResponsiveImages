import { ScoringEngine } from './modules/scoringEngine.js';
import { UrlParser } from './modules/urlParser.js';
import { MarkupBuilder } from './modules/markupBuilder.js';

/**
 * A Marked extension class for handling responsive images.
 * Encapsulates parsing logic and configuration for generating responsive image sources.
 *
 * @param {Object} [options={}] - Configuration options.
 * @param {string} [options.sizes=null] - The value used for the image element's sizes attribute.
 * @param {boolean} [options.debug=false] - Whether to log warnings and errors.
 * @param {boolean} [options.lazy=true] - Whether to enable images lazy loading.
 * @param {string} [options.class=''] - The class attribute to apply to rendered <img> tags.
 * @param {string} [options.pictureClass=''] - The class attribute to apply to the <picture> tag.
 * @param {string} [options.decoding='auto'] - The decoding attribute for the <img> tag.
 * @param {boolean} [options.renderSimpleImgTags=false] - Whether to generate a simple <img> tag.
 * @param {Array<string>} [options.formatPriority] - The priority order for sorting <source> formats.
 * @param {number} [options.lazyLoadThreshold=0] - The threshold score before lazy loading kicks in. A value of 0 disables the feature.
 * @param {Object} [options.scoringWeights=null] - Custom weights to override the ScoringEngine defaults.
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
	 * @private
	 * @type {RegExp}
	 */
	#regex;

	/**
	 * The threshold score to disable lazy loading. A value of 0 disables the feature.
	 * @private
	 * @type {number}
	 */
	#lazyLoadThreshold;

	/**
	 * Custom weight overrides for the scoring engine.
	 * @private
	 * @type {Object|null}
	 */
	#scoringWeights;

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
	 * @param {boolean} [options.renderSimpleImgTags=false] - Whether to generate a simple <img> tag.
	 * @param {Array<string>} [options.formatPriority] - The priority order for sorting <source> formats.
	 * @param {number} [options.lazyLoadThreshold=0] - The threshold score before lazy loading kicks in.
	 * @param {Object} [options.scoringWeights=null] - Custom weights to override the ScoringEngine defaults.
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
		this.#lazyLoadThreshold = options.lazyLoadThreshold ?? 0;
		this.#scoringWeights = options.scoringWeights ?? null;

		this.#regex =
			/^(.*)__((?:\d+-\d+(?:-[a-z0-9.]+){0,2})(?:_(?:\d+-\d+(?:-[a-z0-9.]+){0,2}))*)(\.[^.]+)$/i;
	}

	/**
	 * Returns the extension object required by Marked.
	 *
	 * @returns {Object} The Marked extension object.
	 */
	get config() {
		const extensionConfig = {
			name: 'markedResponsiveImages',
			renderer: {
				image: (token) => this.#render(token),
			},
		};

		if (this.#lazyLoadThreshold > 0) {
			let currentScore = 0;
			let seenTokens = new WeakSet();

			extensionConfig.hooks = {
				preprocess: (markdown) => {
					currentScore = 0;
					seenTokens = new WeakSet();
					return markdown;
				},
			};

			extensionConfig.walkTokens = (token) => {
				if (token.type === 'image') {
					token.preventLazy = currentScore < this.#lazyLoadThreshold;
				}

				currentScore += ScoringEngine.calculateScore(
					token,
					this.#scoringWeights,
					seenTokens,
				);
			};
		}

		return extensionConfig;
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
		const parsedUrl = UrlParser.parseUrl(href);

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

		const safeHref = MarkupBuilder.stringEscape(href);

		try {
			const [, base, sizesPart, originalExtension] = match;
			const variants = UrlParser.processVariants(sizesPart, originalExtension);
			const largest = variants[variants.length - 1];

			const sizesValue =
				this.#defaultSizes || `(max-width: ${largest.width}px) 100vw, ${largest.width}px`;
			const sizesAttribute = ` sizes="${MarkupBuilder.stringEscape(sizesValue)}"`;
			const titleAttribute = title ? ` title="${MarkupBuilder.stringEscape(title)}"` : '';

			const isLazy = this.#lazy && !token.preventLazy;
			const lazyLoadingAttribute = isLazy ? ' loading="lazy"' : '';

			let currentDecoding = this.#decoding;
			if (token.preventLazy && currentDecoding === 'async') {
				currentDecoding = 'auto';
			}
			const decodingAttribute = currentDecoding ? ` decoding="${currentDecoding}"` : '';

			const classes = this.#class
				? ` class="${MarkupBuilder.stringEscape(this.#class)}"`
				: '';
			const pictureClasses = this.#pictureClass
				? ` class="${MarkupBuilder.stringEscape(this.#pictureClass)}"`
				: '';

			const warnCallback = (msg) => this.#warn(msg);

			if (this.#renderSimpleImgTags) {
				const srcset = MarkupBuilder.generateSrcset(
					variants,
					base,
					pathname,
					isAbsolute,
					origin,
					search,
					hash,
					href,
					warnCallback,
				);

				return `<img${classes} src="${safeHref}" srcset="${srcset}"${sizesAttribute} width="${largest.width}" height="${largest.height}" alt="${MarkupBuilder.stringEscape(text)}"${titleAttribute}${lazyLoadingAttribute}${decodingAttribute}>`;
			}

			const sourcesHtml = MarkupBuilder.generatePictureSources(
				variants,
				base,
				pathname,
				isAbsolute,
				origin,
				search,
				hash,
				href,
				sizesAttribute,
				this.#formatPriority,
				warnCallback,
			);

			return `<picture${pictureClasses}>${sourcesHtml}<img${classes} src="${safeHref}" width="${largest.width}" height="${largest.height}" alt="${MarkupBuilder.stringEscape(text)}"${titleAttribute}${lazyLoadingAttribute}${decodingAttribute}></picture>`;
		} catch (error) {
			this.#error(`Error generating HTML for ${filename}`, error);
			return false;
		}
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
 * @param {boolean} [options.renderSimpleImgTags=false] - Whether to generate a simple <img> tag.
 * @param {string} [options.class=''] - The class attribute to apply to rendered <img> tags.
 * @param {string} [options.pictureClass=''] - The class attribute to apply to the <picture> tag.
 * @param {string} [options.decoding='auto'] - The decoding attribute for the <img> tag.
 * @param {Array<string>} [options.formatPriority] - The priority order for sorting <source> formats.
 * @param {number} [options.lazyLoadThreshold=0] - The threshold score before lazy loading kicks in.
 * @param {Object} [options.scoringWeights=null] - Custom weights to override the ScoringEngine defaults.
 * @returns {Object} Marked extension object (renderer config).
 */
export function markedResponsiveImages(options = {}) {
	return new MarkedResponsiveImages(options).config;
}
