const idParams = {
  type: 'object',
  properties: { id: { type: 'integer', minimum: 1 } },
  required: ['id'],
};

export const sendReceiptSchema = { params: idParams };
export const getNotificationsSchema = { params: idParams };
