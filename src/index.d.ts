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
}

/**
 * A Marked extension to handle responsive images.
 * @param options - Configuration options.
 * @returns The Marked extension object.
 */
export default function markedResponsiveImages(options?: ResponsiveImageOptions): MarkedExtension;
