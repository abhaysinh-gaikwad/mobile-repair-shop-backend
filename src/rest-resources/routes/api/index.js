import express from 'express';

import authRouter from './auth.router';
import crmRouter from './crm.router';
import engineerRouter from './engineer.router';
import {
  billingRouter,
  customerRouter,
  dashboardRouter,
  leadHandlerRouter,
  leadSourceRouter,
  reportRouter,
  settingRouter,
  supplierRouter,
  whatsappWebRouter,
} from './misc.router';
import rateCardRouter from './rateCard.router';
import repairRouter from './repair.router';
import userRouter from './user.router';
import whatsappWebhookRouter from './whatsappWebhook.router';

const apiRouter = express.Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/repairs', repairRouter);
apiRouter.use('/engineers', engineerRouter);
apiRouter.use('/customers', customerRouter);
apiRouter.use('/lead-handlers', leadHandlerRouter);
apiRouter.use('/lead-sources', leadSourceRouter);
apiRouter.use('/suppliers', supplierRouter);
apiRouter.use('/billing', billingRouter);
apiRouter.use('/reports', reportRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/settings', settingRouter);
apiRouter.use('/whatsapp/web', whatsappWebRouter);
apiRouter.use('/rate-card', rateCardRouter);
apiRouter.use('/crm', crmRouter);
apiRouter.use('/users', userRouter);

// Meta's callback. Unauthenticated by necessity (Meta has no login) —
// authenticity is proved by the request signature instead.
apiRouter.use('/webhooks/whatsapp', whatsappWebhookRouter);

export default apiRouter;
