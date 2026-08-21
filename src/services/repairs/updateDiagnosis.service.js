import db from '@src/db/models';
import { AppError } from '@src/errors/app.error';
import { Errors } from '@src/errors/errorCodes';
import { getRepairMoneySummary, recalculateRepairTotal } from '@src/helpers/repair.helpers';
import { getSuccessResponse } from '@src/helpers/response.helpers';
import { BaseHandler } from '@src/libs/logicBase';

/**
 * Record what the engineer actually found and did.
 *
 * This is separate from the customer's complaint on purpose: the complaint is
 * "phone not charging", the diagnosis is "charging IC damaged". Both are kept.
 */
export default class UpdateDiagnosisService extends BaseHandler {
  async run() {
    const { id, diagnosis, repairDetails, notes, labourCharge, finalAmount } = this.args;
    const transaction = this.dbTransaction;

    const repairJob = await db.RepairJob.findByPk(id, { transaction });
    if (!repairJob) throw new AppError(Errors.REPAIR_NOT_FOUND);

    const patch = {};
    if (diagnosis !== undefined) patch.diagnosis = diagnosis;
    if (repairDetails !== undefined) patch.repairDetails = repairDetails;
    if (notes !== undefined) patch.notes = notes;
    if (labourCharge !== undefined) patch.labourCharge = labourCharge;
    // The final amount the customer is actually charged. `null` clears it and
    // falls back to parts + labour.
    if (finalAmount !== undefined) patch.finalAmount = finalAmount === null ? null : finalAmount;

    await repairJob.update(patch, { transaction });

    // Labour feeds the parts total, so it must be recomputed here.
    if (labourCharge !== undefined) await recalculateRepairTotal(repairJob.id, transaction);

    const money = await getRepairMoneySummary(repairJob.id, transaction);

    return {
      ...getSuccessResponse('Repair details updated successfully.'),
      repairJob: {
        id: repairJob.id,
        receiptNumber: repairJob.receiptNumber,
        diagnosis: patch.diagnosis ?? repairJob.diagnosis,
        repairDetails: patch.repairDetails ?? repairJob.repairDetails,
        ...money,
      },
    };
  }
}
