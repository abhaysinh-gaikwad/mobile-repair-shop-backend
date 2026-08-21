import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getRepairMoneySummary } from '@src/helpers/repair.helpers';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { round2 } from '@src/utils/money.utils';

/**
 * Everything the printed Marathi receipt needs, flattened into one payload so
 * the print page makes a single request and can render immediately (a print
 * dialog opening before the data arrives would produce a blank slip).
 *
 * Shop details come from settings, never hard-coded, so the owner can correct
 * the Marathi spelling without a code change.
 */
export default class GetReceiptDataService extends BaseHandler {
  async run() {
    const { id } = this.args;

    const repairJob = await db.RepairJob.findByPk(id, {
      include: [
        { model: db.Customer, as: 'customer' },
        { model: db.Engineer, as: 'engineer', attributes: ['id', 'name'] },
        { model: db.RepairPart, as: 'parts' },
        { model: db.RepairCallLog, as: 'callLogs' },
      ],
      order: [[{ model: db.RepairCallLog, as: 'callLogs' }, 'calledAt', 'ASC']],
    });

    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    const settingRows = await db.ShopSetting.findAll();
    const settings = settingRows.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    const money = await getRepairMoneySummary(repairJob.id);
    const plain = repairJob.toJSON();

    return {
      ...getSuccessResponse('Receipt data fetched successfully.'),
      receipt: {
        shop: {
          nameMarathi: settings.shop_name_marathi ?? '',
          nameEnglish: settings.shop_name ?? '',
          addressMarathi: settings.shop_address_marathi ?? '',
          phone1: settings.shop_phone_1 ?? '',
          phone2: settings.shop_phone_2 ?? '',
          termsMarathi: (settings.receipt_terms_marathi ?? '').split('\n').filter(Boolean),
          paperSize: settings.receipt_paper_size ?? 'A5',
          copies: Number(settings.receipt_copies ?? 1),
        },
        receiptNumber: plain.receiptNumber,
        receivedAt: plain.receivedAt,
        customer: {
          name: plain.customer?.name ?? '',
          mobile: plain.customer?.mobile ?? '',
          // Printed on the slip so the shop can find the customer again.
          address: plain.customer?.address ?? '',
        },
        engineer: plain.engineer?.name ?? '',
        device: {
          brand: plain.brand,
          modelNumber: plain.modelNumber,
          imei: plain.imei ?? '',
        },
        itemsReceived: {
          simCard: plain.hasSimCard,
          memoryCard: plain.hasMemoryCard,
          battery: plain.hasBattery,
          charger: plain.hasCharger,
          other: plain.otherAccessories ?? '',
        },
        customerComplaint: plain.customerComplaint,
        diagnosis: plain.diagnosis ?? '',
        repairDetails: plain.repairDetails ?? '',
        status: plain.status,
        parts: plain.parts.map((part) => ({
          partName: part.partName,
          quantity: part.quantity,
          unitPrice: round2(part.unitPrice),
          totalPrice: round2(part.totalPrice),
        })),
        labourCharge: round2(plain.labourCharge),
        // The quotation given at intake, shown when no final amount is set yet.
        estimatedCost: plain.estimatedCost === null ? null : round2(plain.estimatedCost),
        callLogs: plain.callLogs.map((log) => ({
          calledAt: log.calledAt,
          calledBy: log.calledBy,
          communication: log.communication,
        })),
        ...money,
      },
    };
  }
}
