import { MarkedExtension } from 'marked';

/**
 * Configuration options for the responsive images extension.
 */
export interface ResponsiveImageOptions {
	/** The value used for the image element's sizes attribute.
	 * @example "(max-width: 600px) 480px, 800px"
	 */
	sizes?: string;

	/** Whether to log warnings and errors to the console.
	 * @default false
	 */
	debug?: boolean;

	/** Whether to enable lazy loading for images.
	 * @default true
	 */
	lazy?: boolean;

	/** Whether to generate a simple <img> tag with a srcset attribute instead of a full <picture> element.
	 * Note: When enabled, format variations (like WebP) are automatically stripped out.
	 * @default false
	 */
	renderSimpleImgTags?: boolean;

	/** The class attribute to apply to rendered <img> tags.
	 * @default ''
	 */
	imageClass?: string;
}

/**
 * A Marked extension to handle responsive images.
 * @param options - Configuration options.
 * @returns The Marked extension object.
 */
export default function markedResponsiveImages(options?: ResponsiveImageOptions): MarkedExtension;
