export const STATE_MESSAGES = {
  /**
   * Builds an error message when a list endpoint's schema does not contain exactly one top-level array of objects.
   *
   * @param {number} count - The number of top-level object array candidates found.
   * @returns {string} Formatted error message.
   * @example
   * STATE_MESSAGES.LIST_SHAPE_INVALID(0);
   * // Returns: "Stateful list endpoint must define exactly one top-level array of objects; found 0"
   */
  LIST_SHAPE_INVALID: (count: number) =>
    `Stateful list endpoint must define exactly one top-level array of objects; found ${count}`,

  /**
   * Error message when a unique record ID cannot be generated within schema constraints.
   */
  UNIQUE_ID_FAILED: 'Could not generate a unique collection record id',

  /**
   * Builds an error message when no stateful collection exists for an endpoint invocation.
   *
   * @param {string} method - HTTP method.
   * @param {string} path - URL path.
   * @returns {string} Formatted error message.
   * @example
   * STATE_MESSAGES.COLLECTION_UNAVAILABLE('POST', '/products');
   * // Returns: "No stateful collection is available for POST /products"
   */
  COLLECTION_UNAVAILABLE: (method: string, path: string) =>
    `No stateful collection is available for ${method} ${path}`,

  /**
   * Fallback error message returned when a requested record is not found in a collection.
   */
  RECORD_NOT_FOUND: 'Record not found'
} as const;
