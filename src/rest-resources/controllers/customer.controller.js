import { sendResponse } from '@src/helpers/response.helpers';
import {
  GetCustomerService,
  GetCustomersService,
  UpdateCustomerService,
} from '@src/services/customers/manageCustomers.service';

export default class CustomerController {
  static async getCustomers(req, res, next) {
    try {
      const data = await GetCustomersService.execute({ ...req.query }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async getCustomerById(req, res, next) {
    try {
      const data = await GetCustomerService.execute({ id: Number(req.params.id) }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }

  static async updateCustomer(req, res, next) {
    try {
      const data = await UpdateCustomerService.execute({ id: Number(req.params.id), ...req.body }, req.context);
      sendResponse({ req, res, next }, data);
    } catch (error) {
      next(error);
    }
  }
}
