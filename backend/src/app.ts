import dotenv from 'dotenv';
dotenv.config();

// Validate env vars FIRST — before any other imports that might use them
import { validateEnv } from './lib/env';
validateEnv();

import express from 'express';
import cors from 'cors';
import { vectorStore } from './services/vectorStore';
import { errorHandler } from './middleware/errorHandler';
import { ok } from './lib/response';
import searchRouter from './routes/search';

const app = express();
const PORT = process.env.PORT || 3001;

// In production, replace with your actual deployed frontend domain.
// CORS is intentionally restrictive — no wildcard in production.
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
}));
app.use(express.json());

// Track startup stage for the health endpoint
let startupStage = 'initialising';

// Health check — always available, even during the startup pipeline.
// The frontend polls this before showing the main UI.
app.get('/health', (_req, res) => {
  res.json(ok({
    ready: vectorStore.isReady(),
    ...(vectorStore.isReady() ? {} : { startupStage }),
  }));
});

// NOTE: /api/publications/meta must be registered before /api/publications
// to prevent Express matching "meta" as a dynamic :id segment.
// Full route registration will be added in Session 2 once all routes exist.
app.use('/api/search', searchRouter);

app.use(errorHandler);

async function bootstrap(): Promise<void> {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   Foleon Content Hub — Backend       ║');
  console.log('╚══════════════════════════════════════╝\n');

  // Start listening immediately so /health is reachable during startup
  app.listen(PORT, () => {
    console.log(`[Server] Listening on http://localhost:${PORT}`);
    console.log(`[Server] /health available — ready: false\n`);
  });

  try {
    // Session 1 skeleton — sanitiser and vectorStore.build() will be wired
    // in Session 2 once sanitizer.ts and the remaining routes are added.
    startupStage = 'ready';
    console.log('✅ Session 1 skeleton ready — sanitiser pipeline not yet wired\n');
  } catch (err) {
    console.error('\n❌ Fatal startup error:', err);
    process.exit(1);
  }
}

bootstrap();
