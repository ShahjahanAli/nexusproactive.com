import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger, widgetChatLimiter } from './middleware/rateLimit';
import { healthCheckDb } from './db';
import { healthCheckRedis } from './services/redis';
import authRoutes from './routes/auth';
import tenantRoutes from './routes/tenant';
import sitesRoutes from './routes/sites';
import webhooksRoutes from './routes/webhooks';
import chatRoutes from './routes/chat';
import conversationsRoutes from './routes/conversations';
import signalsRoutes from './routes/signals';
import visitorsRoutes from './routes/visitors';
import devMockRoutes from './routes/devMock';

export function createApp() {
  const app = express();

  app.use(requestLogger);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    }),
  );

  app.use('/webhooks', webhooksRoutes);

  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', async (_req, res) => {
    const [dbOk, redisOk] = await Promise.all([
      healthCheckDb(),
      healthCheckRedis(),
    ]);
    const redisHealthy = redisOk === 'disabled' || redisOk === true;
    const status = dbOk && redisHealthy ? 200 : 503;
    res.status(status).json({
      status: dbOk && redisHealthy ? 'ok' : 'degraded',
      db: dbOk,
      redis: redisOk,
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/auth', authRoutes);
  app.use('/tenant', tenantRoutes);
  app.use('/sites', sitesRoutes);
  app.use('/conversations', conversationsRoutes);
  app.use('/signals', signalsRoutes);
  app.use('/visitors', visitorsRoutes);
  app.use('/v1/chat', widgetChatLimiter, chatRoutes);

  if (config.nodeEnv !== 'production') {
    app.use('/dev/mock', devMockRoutes);
  }

  app.use(errorHandler);

  return app;
}
