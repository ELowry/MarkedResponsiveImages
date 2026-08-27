import { MarkedExtension } from 'marked';

/**
 * Configuration options for the responsive images extension.
 */
export interface ResponsiveImageOptions {
	/**
	 * The value used for the image element's sizes attribute.
	 * If omitted, a default sizes attribute is generated based on the largest variant.
	 * @example "(max-width: 600px) 480px, 800px"
	 */
	sizes?: string | null;
	/**
	 * Whether to log warnings and errors.
	 * @default false
	 */
	debug?: boolean;
	/**
	 * Whether to enable lazy loading for images.
	 * @default true
	 */
	lazy?: boolean;
	/**
	 * Whether to generate a simple <img> tag instead of a full <picture> structure.
	 * Note: When enabled, format variations (like WebP) are automatically stripped out.
	 * @default false
	 */
	renderSimpleImgTags?: boolean;
	/**
	 * The class attribute to apply to rendered <img> tags.
	 * @default ''
	 */
	class?: string;
	/**
	 * The class attribute to apply to the <picture> tag.
	 * @default ''
	 */
	pictureClass?: string;
	/**
	 * The decoding attribute for the <img> tag.
	 * @default 'auto'
	 */
	decoding?: 'auto' | 'sync' | 'async' | string;
	/**
	 * The priority order for sorting <source> formats.
	 * @default ['jxl', 'avif', 'webp', 'png', 'jpeg', 'jpg', 'gif', 'svg']
	 */
	formatPriority?: string[];
	/**
	 * The threshold score before lazy loading kicks in. A value of 0 disables the feature.
	 * @default 0
	 */
	lazyLoadThreshold?: number;
	/**
	 * Custom weight overrides for the scoring engine to fine-tune layout calculations.
	 */
	scoringWeights?: {
		base?: Record<string, number>;
		char?: number;
	} | null;
}

/**
 * A Marked extension class for handling responsive images.
 * Encapsulates parsing logic and configuration for generating responsive image sources.
 * @param options - Configuration options.
 * @returns The Marked extension object.
 */
export function markedResponsiveImages(options?: ResponsiveImageOptions): any;
