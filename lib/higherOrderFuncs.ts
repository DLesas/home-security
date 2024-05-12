type withRetry = <T, Args extends any[]>(
  func: (...args: Args) => Promise<T>,
  userErrorMessage: string,
  retries?: number,
  baseDelayMs?: number,
) => (...funcArgs: Args) => Promise<T | string>;

/**
 * A function that retries a given function with an exponential backoff strategy.
 *
 * @param {Function} func - The function to be retried.
 * @param {string} userErrorMessage - The error message to be returned if the function fails after all retries.
 * @param {number} retries - The maximum number of retries. Default is 5.
 * @param {number} baseDelayMs - The base delay in milliseconds for the exponential backoff strategy. Default is 500.
 * @return {Promise<any>} - A promise that resolves with the result of the function if it succeeds, or rejects with the userErrorMessage if it fails after all retries.
 */
export const withRetryExponentialBackoff: withRetry =
  (func, userErrorMessage, retries = 5, baseDelayMs = 500) =>
  async (...funcArgs) => {
    let attempt = 0;
    while (attempt < retries - 1) {
      try {
        const result = await func(...funcArgs);
        return result;
      } catch (error) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt++;
      }
    }

    // TODO: log error to external system
    //console.log(func.name);
    //console.log(funcArgs);
    //console.log(e);
    return userErrorMessage;
  };
