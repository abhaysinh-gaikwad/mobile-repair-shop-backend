import express from 'express';

import WhatsAppWebhookController from '@src/rest-resources/controllers/whatsappWebhook.controller';

/**
 * Meta's callback URL. Deliberately NOT behind isAuthenticated(): Meta's
 * servers call it and have no login. Authenticity is proved instead by the
 * X-Hub-Signature-256 HMAC, checked in the controller.
 *
 * Also deliberately outside contextMiddleware/requestValidationMiddleware —
 * the payload shape is Meta's, not ours, and rejecting an unexpected field
 * would silently drop real customer enquiries whenever Meta adds one.
 */
const whatsappWebhookRouter = express.Router({ mergeParams: true });

whatsappWebhookRouter.get('/', WhatsAppWebhookController.verify);
whatsappWebhookRouter.post('/', WhatsAppWebhookController.receive);

export default whatsappWebhookRouter;
