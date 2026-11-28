import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import timeout from 'connect-timeout';
import hpp from 'hpp';
import type { Request, Response, NextFunction } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { security, apiLimiter, uploadLimiter } from '@/config/index';
import { auth } from '@/features/auth/auth';
import { apiRouters, webhookRouter } from '@/routes/index';

const app: express.Express = express();

app.set('trust proxy', 1);

app.use(timeout('30s'));
app.use(security);

app.use(
  cors({
    origin: (origin, cb) => {
      if (
        !origin ||
        origin === 'https://syncvibe.thakur.dev' ||
        origin === 'http://localhost:5173' ||
        /^https:\/\/([a-z0-9-]+\.)*thakur\.dev$/.test(origin)
      ) {
        cb(null, true);
      } else {
        cb(Object.assign(new Error('Blocked by CORS'), { statusCode: 403 }));
      }
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(compression());
app.use(hpp());

// Webhooks and Better Auth read the raw request body, so they come before the JSON parser.
app.use('/api', webhookRouter);
app.all('/api/auth/*', toNodeHandler(auth));

app.use(express.json({ limit: '2mb' }));

app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.use(apiLimiter);

app.use('/api/upload', uploadLimiter, timeout('60s'));

app.get('/health', (_: Request, res: Response) =>
  res.json({ status: 'ok', message: 'SyncVibe is running', timestamp: Date.now() })
);

app.use('/api', ...apiRouters);

app.use(
  (
    err: Error & { statusCode?: number; type?: string },
    req: Request & { timedout?: boolean },
    res: Response,
    next: NextFunction
  ) => {
    if (err.type === 'entity.parse.failed') {
      res.status(400).json({ message: 'Invalid JSON' });
      return;
    }
    console.error(err);
    // Already answered (a handler that finished after the request timed out): just close it.
    if (res.headersSent) {
      next(err);
      return;
    }
    if (req.timedout) {
      res.status(408).json({ message: 'Request timeout' });
      return;
    }
    res.status(err.statusCode || 500).json({
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
  }
);

export default app;
