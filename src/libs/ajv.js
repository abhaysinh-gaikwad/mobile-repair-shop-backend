import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Shared AJV instance.
 *
 * `coerceTypes` matters a lot: query strings arrive as text, so `?page=2`
 * must coerce to the integer 2 for the numeric schemas to pass.
 */
const ajv = new Ajv({
  allErrors: true,
  useDefaults: true,
  coerceTypes: true,
  removeAdditional: false,
});

addFormats(ajv);

export default ajv;
