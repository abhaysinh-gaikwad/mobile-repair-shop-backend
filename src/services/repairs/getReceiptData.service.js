import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getRepairMoneySummary } from '@src/helpers/repair.helpers';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import { decryptSecret } from '@src/utils/crypto.utils';
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
    const { id, adminId } = this.args;
    const transaction = this.dbTransaction;

    // `unscoped`: the default scope hides deviceUnlockSecret. The receipt
    // template has a "मोबाईल लॉक" box printed specifically for the shop to
    // write the unlock down by hand — this replaces that with the actual
    // saved one (pattern drawn as dots, PIN/password printed as text). Same
    // as the on-screen reveal, every read is logged below.
    const repairJob = await db.RepairJob.unscoped().findByPk(id, {
      include: [
        { model: db.Customer, as: 'customer' },
        { model: db.Engineer, as: 'engineer', attributes: ['id', 'name'] },
        { model: db.RepairPart, as: 'parts' },
        { model: db.RepairCallLog, as: 'callLogs' },
        { model: db.RepairEstimate, as: 'estimates' },
      ],
      order: [
        [{ model: db.RepairCallLog, as: 'callLogs' }, 'calledAt', 'ASC'],
        [{ model: db.RepairEstimate, as: 'estimates' }, 'id', 'ASC'],
      ],
    });

    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    let unlockPattern = null;
    let unlockCode = null;
    if (repairJob.deviceUnlockType && repairJob.deviceUnlockSecret) {
      const decrypted = decryptSecret(repairJob.deviceUnlockSecret);
      if (decrypted) {
        if (repairJob.deviceUnlockType === 'PATTERN') unlockPattern = decrypted;
        else unlockCode = decrypted;

        await db.DeviceUnlockAccessLog.create(
          { repairJobId: repairJob.id, adminUserId: adminId ?? null },
          { transaction },
        );
      }
    }

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
        deviceUnlockType: plain.deviceUnlockType ?? null,
        // Dot-index string ("1-2-5-8-9"), PATTERN locks only — see the note above.
        unlockPattern,
        // Plain PIN/password text — PIN and PASSWORD locks only.
        unlockCode,
        itemsReceived: {
          simCard: plain.hasSimCard,
          memoryCard: plain.hasMemoryCard,
          battery: plain.hasBattery,
          charger: plain.hasCharger,
          other: plain.otherAccessories ?? '',
        },
        customerComplaint: plain.customerComplaint,
        // What the CUSTOMER says about the phone's own history (e.g. tried
        // elsewhere already) — printed in the "Mobile Repair History &
        // Details" box, since that's a much more useful thing to put there
        // than this shop's own internal visit records.
        customerHistoryNote: plain.customerHistoryNote ?? '',
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
        // The quote components themselves — printed comma-separated in the
        // Expense Details box, since parts are usually added later, not at intake.
        estimates: plain.estimates.map((estimate) => round2(estimate.amount)),
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
