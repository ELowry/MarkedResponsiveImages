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
 * Controller responsible for parsing URLs and size variants from markdown image tokens.
 */
class UrlParserController {
	/**
	 * Parses a URL string handling absolute and relative paths.
	 *
	 * @param {string} href - The URL to parse.
	 * @returns {{origin: string, pathname: string, search: string, hash: string, isAbsolute: boolean}|null} The parsed URL components.
	 */
	parseUrl(href) {
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
			// Fallback for relative paths
			const hashIndex = href.indexOf('#');
			const hash = hashIndex !== -1 ? href.slice(hashIndex) : '';
			const withoutHash = hashIndex !== -1 ? href.slice(0, hashIndex) : href;

			const searchIndex = withoutHash.indexOf('?');
			const search = searchIndex !== -1 ? withoutHash.slice(searchIndex) : '';
			const pathname = searchIndex !== -1 ? withoutHash.slice(0, searchIndex) : withoutHash;

			return { origin: '', pathname, search, hash, isAbsolute: false };
		}
	}

	/**
	 * Processes the size string into usable variant objects.
	 *
	 * @param {string} sizesPart - The string containing size definitions.
	 * @param {string} originalExtension - The file extension of the original image.
	 * @returns {Array<ImageVariant>} Sorted array of variant objects.
	 */
	processVariants(sizesPart, originalExtension) {
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
}

export const UrlParser = new UrlParserController();
