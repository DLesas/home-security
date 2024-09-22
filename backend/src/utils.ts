import { uuidv7 } from 'uuidv7'

/**
 * Generates a UUID v7 without hyphens.
 *
 * @returns {string} The generated ID.
 */
export const makeID = (): string => {
	return uuidv7().replace(/-/g, "");
};