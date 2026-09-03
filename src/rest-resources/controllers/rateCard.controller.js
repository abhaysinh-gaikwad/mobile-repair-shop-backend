import { sendResponse } from '@src/helpers/response.helpers';
import {
  AddRateCardEntryService,
  CreateRateCardBrandService,
  CreateRateCardModelService,
  CreateRateCardPartService,
  CreateRateTypeService,
  DeleteRateCardEntryService,
  GetRateCardBrandsService,
  GetRateCardModelsService,
  GetRateCardPartsService,
  GetRatesForModelService,
  GetRateTypesService,
  SearchRateCardModelsService,
  ToggleRateCardEntityService,
  UpdateRateCardBrandService,
  UpdateRateCardEntryService,
  UpdateRateCardModelService,
  UpdateRateCardPartService,
  UpdateRateTypeService,
} from '@src/services/rateCard/manageRateCard.service';

export default class RateCardController {
  // ---------------------------------------------------------------- brands
  static async getBrands(req, res, next) {
    try {
      const data = await GetRateCardBrandsService.execute(req.query, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async createBrand(req, res, next) {
    try {
      const data = await CreateRateCardBrandService.execute({ ...req.body, adminId: req.user.id }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async updateBrand(req, res, next) {
    try {
      const data = await UpdateRateCardBrandService.execute(
        { id: Number(req.params.id), ...req.body },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  // ---------------------------------------------------------------- models
  static async getModels(req, res, next) {
    try {
      const data = await GetRateCardModelsService.execute(req.query, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async createModel(req, res, next) {
    try {
      const data = await CreateRateCardModelService.execute({ ...req.body, adminId: req.user.id }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async updateModel(req, res, next) {
    try {
      const data = await UpdateRateCardModelService.execute(
        { id: Number(req.params.id), ...req.body },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async searchModels(req, res, next) {
    try {
      const data = await SearchRateCardModelsService.execute(req.query, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  // ----------------------------------------------------------------- parts
  static async getParts(req, res, next) {
    try {
      const data = await GetRateCardPartsService.execute(req.query, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async createPart(req, res, next) {
    try {
      const data = await CreateRateCardPartService.execute({ ...req.body, adminId: req.user.id }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async updatePart(req, res, next) {
    try {
      const data = await UpdateRateCardPartService.execute({ id: Number(req.params.id), ...req.body }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  // ------------------------------------------------------------ rate types
  static async getRateTypes(req, res, next) {
    try {
      const data = await GetRateTypesService.execute(req.query, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async createRateType(req, res, next) {
    try {
      const data = await CreateRateTypeService.execute({ ...req.body, adminId: req.user.id }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async updateRateType(req, res, next) {
    try {
      const data = await UpdateRateTypeService.execute({ id: Number(req.params.id), ...req.body }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  // --------------------------------------------------------- toggle status
  static async toggleEntity(req, res, next) {
    try {
      const data = await ToggleRateCardEntityService.execute(
        { id: Number(req.params.id), ...req.body },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  // -------------------------------------------------------------- entries
  static async addEntry(req, res, next) {
    try {
      const data = await AddRateCardEntryService.execute({ ...req.body, adminId: req.user.id }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async updateEntry(req, res, next) {
    try {
      const data = await UpdateRateCardEntryService.execute(
        { id: Number(req.params.id), ...req.body, adminId: req.user.id },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async deleteEntry(req, res, next) {
    try {
      const data = await DeleteRateCardEntryService.execute({ id: Number(req.params.id) }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  // -------------------------------------------------------------- lookup
  static async getRatesForModel(req, res, next) {
    try {
      const data = await GetRatesForModelService.execute(
        { modelId: Number(req.params.modelId) },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }
}
