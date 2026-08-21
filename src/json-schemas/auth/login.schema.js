const loginSchema = {
  body: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email', minLength: 3, maxLength: 160 },
      password: { type: 'string', minLength: 1, maxLength: 200 },
    },
    required: ['email', 'password'],
    additionalProperties: false,
  },
};

export default loginSchema;
