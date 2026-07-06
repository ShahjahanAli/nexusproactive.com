import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger, widgetChatLimiter } from './middleware/rateLimit';
import { healthCheckDb } from './db';
import { healthCheckRedis } from './services/redis';
import authRoutes from './routes/auth';
import tenantRoutes from './routes/tenant';
import sitesRoutes from './routes/sites';
import stripeWebhooksRoutes from './routes/stripeWebhooks';
import webhookSubscriptionRoutes from './routes/webhookSubscriptions';
import chatRoutes from './routes/chat';
import conversationsRoutes from './routes/conversations';
import signalsRoutes from './routes/signals';
import visitorsRoutes from './routes/visitors';
import escalationsRoutes from './routes/escalations';
import proactiveRoutes from './routes/proactive';
import widgetRoutes from './routes/widget';
import devMockRoutes from './routes/devMock';

export function createApp() {
  const app = express();

  if (config.nodeEnv === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(requestLogger);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  app.use((req, res, next) => {
    const isWidgetPublic =
      req.path.startsWith('/v1/chat') ||
      req.path.startsWith('/v1/widget') ||
      req.path.startsWith('/widget');
    if (isWidgetPublic) {
      return cors({ origin: '*', credentials: false })(req, res, next);
    }
    return cors({ origin: config.corsOrigin, credentials: true })(req, res, next);
  });

  app.use('/webhooks', stripeWebhooksRoutes);

  const widgetDist = path.resolve(__dirname, '../../widget/dist');
  if (fs.existsSync(widgetDist)) {
    app.use(
      '/widget',
      express.static(widgetDist, {
        maxAge: config.nodeEnv === 'production' ? '1h' : 0,
        setHeaders(res, filePath) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          }
        },
      }),
    );
    app.get('/widget/nexus.js', (_req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.sendFile(path.join(widgetDist, 'nexus.iife.js'));
    });
  }

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
  app.use('/escalations', escalationsRoutes);
  app.use('/webhook-subscriptions', webhookSubscriptionRoutes);
  app.use('/proactive', proactiveRoutes);
  app.use('/v1/widget', widgetRoutes);
  app.use('/v1/chat', widgetChatLimiter, chatRoutes);

  if (config.nodeEnv !== 'production') {
    app.use('/dev/mock', devMockRoutes);
  }

  app.use(errorHandler);

  return app;
}
