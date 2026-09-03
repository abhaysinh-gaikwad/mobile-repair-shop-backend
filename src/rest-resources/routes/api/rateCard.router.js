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
import { requireOwner } from '@src/rest-resources/middlewares/requireOwner';

const rateCardRouter = express.Router({ mergeParams: true });

/**
 * VIEW (any logged-in admin, telecallers included): browse brands/models/
 * parts/rate-types and look up prices.
 *
 * MANAGE (owner only, via requireOwner() after isAuthenticated()): add/edit/
 * toggle brands/models/parts/rate-types, add/edit/delete the price entries
 * themselves. See requireOwner.js — this is the one door in the whole app
 * that currently has a lock on it.
 */
const read = (schema, handler) => [
  contextMiddleware(false),
  isAuthenticated(),
  ...(schema ? [requestValidationMiddleware(schema)] : []),
  handler,
];
const manage = (schema, handler) => [
  contextMiddleware(true),
  isAuthenticated(),
  requireOwner(),
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
