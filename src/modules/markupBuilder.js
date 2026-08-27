/**
 * @typedef {import('./urlParser.js').ImageVariant} ImageVariant
 */

/**
 * Controller responsible for building HTML markup for responsive images.
 */
class MarkupBuilderController {
	/**
	 * Defines the MIME type mapping for supported image extensions.
	 * @constant
	 * @type {Object<string, string>}
	 */
	static get MIME_MAP() {
		return {
			jpg: 'image/jpeg',
			jpeg: 'image/jpeg',
			png: 'image/png',
			webp: 'image/webp',
			avif: 'image/avif',
			gif: 'image/gif',
			svg: 'image/svg+xml',
			jxl: 'image/jxl',
		};
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
		return MarkupBuilderController.MIME_MAP[extension] || '';
	}

	/**
	 * Escapes double quotes in a string for safe HTML attribute usage.
	 *
	 * @param {string} string - The string to escape.
	 * @returns {string} The escaped string.
	 */
	stringEscape(string) {
		return (string || '').replace(/"/g, '&quot;');
	}

	/**
	 * Generates the srcset string.
	 *
	 * @param {Array<ImageVariant>} variants - Processed variants.
	 * @param {string} base - Base filename.
	 * @param {string} pathname - Current pathname.
	 * @param {boolean} isAbsolute - Whether the original URL was absolute.
	 * @param {string} origin - URL origin.
	 * @param {string} search - URL search params.
	 * @param {string} hash - URL hash.
	 * @param {string} originalHref - The raw input href for slash detection.
	 * @param {Function} warn - Callback to log warnings.
	 * @returns {string} The formatted srcset.
	 */
	generateSrcset(variants, base, pathname, isAbsolute, origin, search, hash, originalHref, warn) {
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

					warn(
						`Duplicate descriptor ${variant.descriptor} found. Preferring original format (${originalExtension}) over (${existing.extension}).`,
					);
				} else if (existing.extension === variant.extension) {
					warn(
						`Duplicate variant omitted: ${base}__${variant.token}${variant.extension}`,
					);
				} else {
					warn(
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
	 * @param {Array<ImageVariant>} variants - Processed variants.
	 * @param {string} base - Base filename.
	 * @param {string} pathname - Current pathname.
	 * @param {boolean} isAbsolute - Whether the original URL was absolute.
	 * @param {string} origin - URL origin.
	 * @param {string} search - URL search params.
	 * @param {string} hash - URL hash.
	 * @param {string} originalHref - The raw input href.
	 * @param {string} sizesAttribute - The formatted sizes attribute string.
	 * @param {Array<string>} formatPriority - The priority order for sorting formats.
	 * @param {Function} warn - Callback to log warnings.
	 * @returns {string} The HTML <source> tags.
	 */
	generatePictureSources(
		variants,
		base,
		pathname,
		isAbsolute,
		origin,
		search,
		hash,
		originalHref,
		sizesAttribute,
		formatPriority,
		warn,
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
				warn(`Duplicate variant omitted: ${base}__${variant.token}${variant.extension}`);
				continue;
			}
			byExtension.get(variant.extension).set(variant.descriptor, variant);
		}

		const extensions = Array.from(byExtension.keys()).sort((extensionA, extensionB) => {
			if (extensionA === originalExtension) {
				return 1;
			}
			if (extensionB === originalExtension) {
				return -1;
			}

			const cleanExtensionA = extensionA.replace('.', '').toLowerCase();
			const cleanExtensionB = extensionB.replace('.', '').toLowerCase();

			let priorityIndexA = formatPriority.indexOf(cleanExtensionA);
			let priorityIndexB = formatPriority.indexOf(cleanExtensionB);

			if (priorityIndexA === -1) {
				priorityIndexA = Number.MAX_SAFE_INTEGER;
			}
			if (priorityIndexB === -1) {
				priorityIndexB = Number.MAX_SAFE_INTEGER;
			}

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
}

export const MarkupBuilder = new MarkupBuilderController();
