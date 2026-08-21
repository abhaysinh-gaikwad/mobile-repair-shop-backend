import { sendResponse } from '@src/helpers/response.helpers';
import {
  CreateSupplierService,
  GetSupplierService,
  GetSuppliersService,
  ToggleSupplierStatusService,
  UpdateSupplierService,
} from '@src/services/suppliers/manageSuppliers.service';

export default class SupplierController {
  static async getSuppliers(req, res, next) {
    try {
      sendResponse({ req, res, next }, await GetSuppliersService.execute({ ...req.query }, req.context));
    } catch (error) {
      next(error);
    }
  }

  static async getSupplierById(req, res, next) {
    try {
      const data = await GetSupplierService.execute({ id: Number(req.params.id) }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async createSupplier(req, res, next) {
    try {
      sendResponse({ req, res, next }, await CreateSupplierService.execute({ ...req.body }, req.context));
    } catch (error) {
      next(error);
    }
  }

  static async updateSupplier(req, res, next) {
    try {
      const data = await UpdateSupplierService.execute({ id: Number(req.params.id), ...req.body }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async toggleStatus(req, res, next) {
    try {
      const data = await ToggleSupplierStatusService.execute(
        { id: Number(req.params.id), ...req.body },
        req.context,
      );
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }
}
