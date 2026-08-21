import { DEVICE_UNLOCK_TYPE, REPAIR_STATUS } from '@src/utils/constants/public.constants';

const idParams = {
  type: 'object',
  properties: { id: { type: 'integer', minimum: 1 } },
  required: ['id'],
};

/**
 * Note what is ABSENT: `customerComplaint`. With `additionalProperties: false`
 * an attempt to edit the customer's original complaint is rejected here,
 * before it ever reaches the service.
 */
export const updateRepairSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      brand: { type: 'string', minLength: 1, maxLength: 60 },
      modelNumber: { type: 'string', minLength: 1, maxLength: 120 },
      imei: { type: 'string', maxLength: 30, nullable: true },
      hasSimCard: { type: 'boolean' },
      hasMemoryCard: { type: 'boolean' },
      hasBattery: { type: 'boolean' },
      hasCharger: { type: 'boolean' },
      otherAccessories: { type: 'string', maxLength: 255, nullable: true },
      leadSource: { type: 'string', maxLength: 60, nullable: true },
      leadHandlerId: { type: 'integer', minimum: 1, nullable: true },
      estimatedCost: { type: 'number', minimum: 0, nullable: true },
      labourCharge: { type: 'number', minimum: 0 },
      notes: { type: 'string', maxLength: 2000, nullable: true },
    },
    additionalProperties: false,
  },
};

export const updateRepairStatusSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: Object.values(REPAIR_STATUS) },
      note: { type: 'string', maxLength: 500, nullable: true },
    },
    required: ['status'],
    additionalProperties: false,
  },
};

export const assignEngineerSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      engineerId: { type: 'integer', minimum: 1 },
      note: { type: 'string', maxLength: 500, nullable: true },
    },
    required: ['engineerId'],
    additionalProperties: false,
  },
};

export const updateDiagnosisSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      diagnosis: { type: 'string', maxLength: 2000, nullable: true },
      repairDetails: { type: 'string', maxLength: 2000, nullable: true },
      notes: { type: 'string', maxLength: 2000, nullable: true },
      labourCharge: { type: 'number', minimum: 0 },
      // What the customer is actually charged — distinct from the intake
      // estimate. `null` clears it and falls back to parts + labour.
      finalAmount: { type: ['number', 'null'], minimum: 0 },
    },
    additionalProperties: false,
  },
};

export const getRepairByIdSchema = { params: idParams };

/**
 * Set/replace/clear the device screen-lock credential after intake (the
 * customer often forgets to give it at the counter). Kept off the general
 * update route so the sensitive value has one narrow, explicit entry point.
 */
export const updateDeviceUnlockSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      deviceUnlockType: { type: 'string', enum: Object.values(DEVICE_UNLOCK_TYPE), nullable: true },
      deviceUnlockCredential: { type: 'string', maxLength: 100, nullable: true },
    },
    required: ['deviceUnlockType'],
    additionalProperties: false,
  },
};

export default updateRepairSchema;
