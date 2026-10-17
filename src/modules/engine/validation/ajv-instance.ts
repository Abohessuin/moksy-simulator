import AjvModule from 'ajv';
import addFormatsModule from 'ajv-formats';

// Handle CommonJS / ESM interop for ajv and ajv-formats
const Ajv = (AjvModule as any).default || AjvModule;
const addFormats = (addFormatsModule as any).default || addFormatsModule;

/**
 * Creates and configures an Ajv validator instance.
 * Strict type coercion is disabled to prevent silent JSON body coercion.
 * @returns {Ajv} Configured Ajv validator.
 */
export function createAjvInstance(): any {
  const ajv = new Ajv({
    allErrors: true,
    coerceTypes: false,
    useDefaults: true,
    removeAdditional: false,
    strict: false
  });

  addFormats(ajv);
  return ajv;
}

export const defaultAjv = createAjvInstance();
