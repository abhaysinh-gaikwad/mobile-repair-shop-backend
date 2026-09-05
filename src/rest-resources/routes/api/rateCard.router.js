import express from 'express';

import {
  addRateCardEntrySchema,
  createRateCardBrandSchema,
  createRateCardModelSchema,
  createRateCardPartSchema,
  createRateTypeSchema,
  getRateCardModelsSchema,
  getRatesForModelSchema,
  listActiveSchema,
  rateCardEntryIdParamsSchema,
  searchRateCardModelsSchema,
  toggleRateCardEntitySchema,
  updateRateCardBrandSchema,
  updateRateCardEntrySchema,
  updateRateCardModelSchema,
  updateRateCardPartSchema,
  updateRateTypeSchema,
} from '@src/json-schemas/rateCard/rateCard.schema';
import RateCardController from '@src/rest-resources/controllers/rateCard.controller';
import contextMiddleware from '@src/rest-resources/middlewares/context.middleware';
import { isAuthenticated } from '@src/rest-resources/middlewares/isAuthenticated';
import { requestValidationMiddleware } from '@src/rest-resources/middlewares/requestValidation.middleware';
import { requirePermission } from '@src/rest-resources/middlewares/requirePermission';
import { PERMISSION_ACTION, PERMISSION_MODULE, permission } from '@src/utils/constants/public.constants';

const rateCardRouter = express.Router({ mergeParams: true });

/**
 * VIEW (RATE_CARD:VIEW — telecallers have it by default): browse brands/
 * models/parts/rate-types and look up prices.
 *
 * MANAGE (RATE_CARD:EDIT): add/edit/toggle brands/models/parts/rate-types,
 * add/edit/delete the price entries themselves.
 *
 * This was the app's original single hard-coded owner-only door. It is now an
 * ordinary permission, which is what makes the intended case work: a
 * telecaller sees prices by default, and the Super Admin can grant ONE of
 * them RATE_CARD:EDIT individually without promoting them or changing what
 * every other telecaller can do.
 */
const read = (schema, handler) => [
  contextMiddleware(false),
  isAuthenticated(),
  requirePermission(permission(PERMISSION_MODULE.RATE_CARD, PERMISSION_ACTION.VIEW)),
  ...(schema ? [requestValidationMiddleware(schema)] : []),
  handler,
];
const manage = (schema, handler) => [
  contextMiddleware(true),
  isAuthenticated(),
  requirePermission(permission(PERMISSION_MODULE.RATE_CARD, PERMISSION_ACTION.EDIT)),
  ...(schema ? [requestValidationMiddleware(schema)] : []),
  handler,
];

// ------------------------------------------------------------------ brands
rateCardRouter.get('/brands', ...read(listActiveSchema, RateCardController.getBrands));
rateCardRouter.post('/brands', ...manage(createRateCardBrandSchema, RateCardController.createBrand));
rateCardRouter.put('/brands/:id', ...manage(updateRateCardBrandSchema, RateCardController.updateBrand));

// ------------------------------------------------------------------ models
rateCardRouter.get('/models', ...read(getRateCardModelsSchema, RateCardController.getModels));
rateCardRouter.get('/models/search', ...read(searchRateCardModelsSchema, RateCardController.searchModels));
rateCardRouter.post('/models', ...manage(createRateCardModelSchema, RateCardController.createModel));
rateCardRouter.put('/models/:id', ...manage(updateRateCardModelSchema, RateCardController.updateModel));

// ------------------------------------------------------------------- parts
rateCardRouter.get('/parts', ...read(listActiveSchema, RateCardController.getParts));
rateCardRouter.post('/parts', ...manage(createRateCardPartSchema, RateCardController.createPart));
rateCardRouter.put('/parts/:id', ...manage(updateRateCardPartSchema, RateCardController.updatePart));

// --------------------------------------------------------------- rate types
rateCardRouter.get('/rate-types', ...read(listActiveSchema, RateCardController.getRateTypes));
rateCardRouter.post('/rate-types', ...manage(createRateTypeSchema, RateCardController.createRateType));
rateCardRouter.put('/rate-types/:id', ...manage(updateRateTypeSchema, RateCardController.updateRateType));

// ----------------------------------------------------- toggle (any entity)
rateCardRouter.patch(
  '/entities/:id/status',
  ...manage(toggleRateCardEntitySchema, RateCardController.toggleEntity),
);

// ----------------------------------------------------------------- entries
rateCardRouter.post('/entries', ...manage(addRateCardEntrySchema, RateCardController.addEntry));
rateCardRouter.put('/entries/:id', ...manage(updateRateCardEntrySchema, RateCardController.updateEntry));
rateCardRouter.delete('/entries/:id', ...manage(rateCardEntryIdParamsSchema, RateCardController.deleteEntry));

// ------------------------------------------------------------------ lookup
rateCardRouter.get('/models/:modelId/rates', ...read(getRatesForModelSchema, RateCardController.getRatesForModel));

export default rateCardRouter;
