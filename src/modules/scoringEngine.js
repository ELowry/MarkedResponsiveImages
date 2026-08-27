/**
 * @typedef {Object} Token
 * @property {string} type
 * @property {string} [raw]
 * @property {boolean} [preventLazy]
 * @property {boolean} [ignoreScore] - Internal flag to prevent double-counting nested tokens.
 * @property {Array<Token>} [tokens] - Nested child tokens.
 */

/**
 * Controller responsible for calculating the visual weight of markdown tokens.
 */
class ScoringEngineController {
	/**
	 * Defines the base vertical score (padding, margins, inherent height) for block elements.  
	 * Based on an estimated value of 10 points for roughly 1rem.
	 * @constant
	 * @type {Object<string, number>}
	 */
	static get BASE_WEIGHTS() {
		return {
			blockquote: 30,
			br: 15,
			code: 25,
			heading: 30,
			hr: 20,
			html: 15,
			image: 350,
			list: 10,
			list_item: 5,
			paragraph: 15,
			space: 15,
			table: 40,
		};
	}

	/**
	 * Defines the marked token types that contain text content.
	 * @constant
	 * @type {Array<string>}
	 */
	static get TEXT_NODES() {
		return ['text', 'code', 'codespan', 'html'];
	}

	/**
	 * Defines the character-to-score ratio for text content.
	 * Based on an estimated text width of 60–80 characters and a line height of 1.6rem tall.
	 * @constant
	 * @type {number}
	 */
	static get CHAR_WEIGHT() {
		return 0.25;
	}

	/**
	 * Recursively evaluates table cell tokens to calculate their total vertical score.
	 *
	 * @private
	 * @param {Array<Token>} cellTokens - The tokens within a table cell.
	 * @param {Object<string, number>} baseWeights - The base weights to apply.
	 * @param {number} charWeight - The character multiplier weight.
	 * @param {WeakSet} seenTokens - A set tracking tokens that have already been evaluated.
	 * @returns {number} The calculated visual score for the cell.
	 */
	#evaluateCell(cellTokens, baseWeights, charWeight, seenTokens) {
		let cellScore = 0;
		if (!cellTokens) {
			return cellScore;
		}

		for (const childToken of cellTokens) {
			seenTokens.add(childToken);
			if (baseWeights[childToken.type]) {
				cellScore += baseWeights[childToken.type];
			}

			if (ScoringEngineController.TEXT_NODES.includes(childToken.type) && childToken.raw) {
				let multiplier = charWeight;

				if (childToken.type === 'code') {
					multiplier *= 2;
				}

				cellScore += Math.round(childToken.raw.length * multiplier);
			}

			if (childToken.tokens) {
				cellScore += this.#evaluateCell(
					childToken.tokens,
					baseWeights,
					charWeight,
					seenTokens,
				);
			}
		}

		return cellScore;
	}

	/**
	 * Calculates the visual weight score of a given token based on its structural type and text length.
	 *
	 * @param {Token} token - The marked token to evaluate.
	 * @param {Object} [customWeights=null] - Optional user overrides for base and character weights.
	 * @param {WeakSet} [seenTokens=new WeakSet()] - A set tracking tokens that have already been evaluated.
	 * @returns {number} The calculated visual score for the token.
	 */
	calculateScore(token, customWeights = null, seenTokens = new WeakSet()) {
		if (seenTokens.has(token)) {
			return 0;
		}
		seenTokens.add(token);

		let score = 0;
		const baseWeights = customWeights?.base
			? { ...ScoringEngineController.BASE_WEIGHTS, ...customWeights.base }
			: ScoringEngineController.BASE_WEIGHTS;
		const charWeight = customWeights?.char ?? ScoringEngineController.CHAR_WEIGHT;

		if (baseWeights[token.type]) {
			score += baseWeights[token.type];
		}

		if (token.type === 'table') {
			const allRows = [token.header, ...token.rows];

			for (const row of allRows) {
				let maxCellScore = 0;

				for (const cell of row) {
					const cellScore = this.#evaluateCell(
						cell.tokens,
						baseWeights,
						charWeight,
						seenTokens,
					);

					if (cellScore > maxCellScore) {
						maxCellScore = cellScore;
					}
				}

				score += maxCellScore;
			}
		} else if (ScoringEngineController.TEXT_NODES.includes(token.type) && token.raw) {
			let multiplier = charWeight;

			if (token.type === 'code') {
				multiplier *= 2;
			}

			score += Math.round(token.raw.length * multiplier);
		}

		return score;
	}
}

export const ScoringEngine = new ScoringEngineController();
