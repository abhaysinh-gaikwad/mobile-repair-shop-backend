import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { generateLedgerEntryNo, generateReceiptNumber, recordStatusChange } from '@src/helpers/repair.helpers';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';
import {
  DEVICE_UNLOCK_TYPE,
  LEDGER_ENTRY_TYPE,
  PAYMENT_METHOD,
  PAYMENT_TYPE,
  REPAIR_STATUS,
} from '@src/utils/constants/public.constants';
import { encryptSecret } from '@src/utils/crypto.utils';
import { round2 } from '@src/utils/money.utils';

/**
 * Intake: a customer walks in and hands over a phone.
 *
 * Everything here happens in ONE transaction — customer, job, status history —
 * so a partially-created repair can never exist. The receipt number comes
 * from a Postgres SEQUENCE (see repair.helpers.js) and is therefore safe
 * against concurrent creation.
 */
export default class CreateRepairService extends BaseHandler {
  async run() {
    const {
      customerName,
      customerMobile,
      alternateMobile,
      address,
      leadSource,
      leadHandlerId,
      leadAt,
      brand,
      modelNumber,
      imei,
      hasSimCard,
      hasMemoryCard,
      hasBattery,
      hasCharger,
      otherAccessories,
      customerComplaint,
      customerHistoryNote,
      engineerId,
      estimates,
      advancePayment,
      advancePaymentMethod,
      labourCharge,
      notes,
      deviceUnlockType,
      deviceUnlockCredential,
      previousRepairJobId,
      adminId,
    } = this.args;

    const transaction = this.dbTransaction;
    const mobile = String(customerMobile).trim();

    // Repeat repair: the customer has brought a previously delivered phone
    // back. This creates a COMPLETELY NEW job with its own receipt number —
    // the earlier job is never reopened or edited, only referenced.
    let previousRepair = null;
    if (previousRepairJobId) {
      previousRepair = await db.RepairJob.findByPk(previousRepairJobId, { transaction });
      if (!previousRepair) throw new AppError(Errors.REPAIR_NOT_FOUND);
    }

    if (engineerId) {
      const engineer = await db.Engineer.findByPk(engineerId, { transaction });
      if (!engineer) throw new AppError(Errors.ENGINEER_NOT_FOUND);
      if (!engineer.isActive) throw new AppError(Errors.ENGINEER_INACTIVE);
    }

    if (leadHandlerId) {
      const leadHandler = await db.LeadHandler.findByPk(leadHandlerId, { transaction });
      if (!leadHandler) throw new AppError(Errors.LEAD_HANDLER_NOT_FOUND);
    }

    // Find-or-create the customer by mobile. A repeat customer keeps their
    // history; only genuinely new details are written.
    let customer = await db.Customer.findOne({ where: { mobile }, transaction });

    if (customer) {
      const patch = {};
      if (alternateMobile && !customer.alternateMobile) patch.alternateMobile = alternateMobile;
      if (address && !customer.address) patch.address = address;
      if (Object.keys(patch).length) await customer.update(patch, { transaction });
    } else {
      customer = await db.Customer.create(
        {
          name: String(customerName).trim(),
          mobile,
          alternateMobile: alternateMobile ?? null,
          address: address ?? null,
          // First-touch attribution on the customer; the job below keeps its
          // own per-visit copy.
          leadSource: leadSource ?? null,
          leadHandlerId: leadHandlerId ?? null,
          firstVisitAt: new Date(),
        },
        { transaction },
      );
    }

    const receiptNumber = await generateReceiptNumber(transaction);
    // Every intake starts at PENDING regardless of whether an engineer is
    // assigned up front — there is no separate "assigned" status; assigning
    // an engineer is tracked via engineer_id, not the repair's status.
    const status = REPAIR_STATUS.PENDING;
    const labour = round2(labourCharge ?? 0);

    // Multiple quote components entered together at intake (e.g. "500
    // original", "300 market") — the job's quoted total is the sum of every
    // row's amount; each row's note (if any) is kept alongside it.
    const estimateRows = (estimates ?? [])
      .map((row) => ({ amount: round2(row.amount), note: row.note?.trim() || null }))
      .filter((row) => row.amount > 0);
    const estimatedCost = estimateRows.length
      ? round2(estimateRows.reduce((sum, row) => sum + row.amount, 0))
      : null;

    const repairJob = await db.RepairJob.create(
      {
        receiptNumber,
        customerId: customer.id,
        engineerId: engineerId ?? null,
        leadSource: leadSource ?? null,
        leadHandlerId: leadHandlerId ?? null,
        leadAt: leadAt ?? null,
        brand: String(brand).trim(),
        modelNumber: String(modelNumber).trim(),
        imei: imei ? String(imei).trim() : null,
        hasSimCard: Boolean(hasSimCard),
        hasMemoryCard: Boolean(hasMemoryCard),
        hasBattery: Boolean(hasBattery),
        hasCharger: Boolean(hasCharger),
        otherAccessories: otherAccessories ?? null,
        customerComplaint: String(customerComplaint).trim(),
        customerHistoryNote: customerHistoryNote?.trim() || null,

        // Screen-lock credential only, encrypted before it ever reaches the DB.
        deviceUnlockType: deviceUnlockType && deviceUnlockType !== DEVICE_UNLOCK_TYPE.NONE ? deviceUnlockType : null,
        deviceUnlockSecret: encryptSecret(deviceUnlockCredential),

        previousRepairJobId: previousRepair?.id ?? null,
        repeatOfReceipt: previousRepair?.receiptNumber ?? null,

        status,
        estimatedCost: estimatedCost ?? null,
        labourCharge: labour,
        // No parts yet, so the total starts as labour alone.
        totalAmount: labour,
        notes: notes ?? null,
        receivedAt: new Date(),
        createdBy: adminId ?? null,
      },
      { transaction },
    );

    await recordStatusChange(
      {
        repairJobId: repairJob.id,
        fromStatus: null,
        toStatus: status,
        note: previousRepair ? `Repeat repair of ${previousRepair.receiptNumber}` : 'Repair job created',
        changedBy: adminId,
      },
      transaction,
    );

    // Seed the estimate history — one row per component entered at intake —
    // so it appears alongside any later additions instead of being a number
    // with no record behind it.
    for (const row of estimateRows) {
      await db.RepairEstimate.create(
        { repairJobId: repairJob.id, amount: row.amount, note: row.note, createdBy: adminId ?? null },
        { transaction },
      );
    }

    // Money taken at the counter right at intake — a real ledger payment,
    // not just a number printed on paper, so it shows up correctly in Billing.
    if (advancePayment && round2(advancePayment) > 0) {
      const paymentAmount = round2(advancePayment);
      const jobBalanceAfter = round2(labour - paymentAmount);

      await db.RepairLedger.create(
        {
          entryNo: await generateLedgerEntryNo(transaction),
          repairJobId: repairJob.id,
          receiptNumber,
          customerId: customer.id,
          customerName: customer.name,
          customerMobile: customer.mobile,
          entryType: LEDGER_ENTRY_TYPE.PAYMENT,
          paymentType: PAYMENT_TYPE.ADVANCE,
          paymentMethod: advancePaymentMethod || PAYMENT_METHOD.CASH,
          amount: paymentAmount,
          jobTotalAfter: labour,
          jobPaidAfter: paymentAmount,
          jobBalanceAfter,
          note: 'Advance taken at intake',
          paidAt: new Date(),
          receivedBy: adminId ?? null,
        },
        { transaction },
      );
    }

    return {
      ...getSuccessResponse(`Repair job ${receiptNumber} created successfully.`),
      repairJob: {
        id: repairJob.id,
        receiptNumber: repairJob.receiptNumber,
        status: repairJob.status,
        customerId: customer.id,
        customerName: customer.name,
        customerMobile: customer.mobile,
        totalAmount: round2(repairJob.totalAmount),
        repeatOfReceipt: repairJob.repeatOfReceipt,
        // Never the credential itself — only whether one was recorded.
        hasDeviceUnlock: Boolean(repairJob.deviceUnlockSecret),
      },
    };
  }
}
