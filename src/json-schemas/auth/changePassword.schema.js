const changePasswordSchema = {
  body: {
    type: 'object',
    properties: {
      currentPassword: { type: 'string', minLength: 1, maxLength: 200 },
      newPassword: { type: 'string', minLength: 8, maxLength: 200 },
    },
    required: ['currentPassword', 'newPassword'],
    additionalProperties: false,
  },
};

export default changePasswordSchema;
