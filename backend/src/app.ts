import dotenv from 'dotenv';
dotenv.config();

// Validate env vars FIRST — before any other imports that might use them
import { validateEnv } from './lib/env';
validateEnv();

import express from 'express';
import cors from 'cors';
import { sanitizePublications, parseRawPublications } from './services/sanitizer';
import { vectorStore } from './services/vectorStore';
import { errorHandler } from './middleware/errorHandler';
import { ok } from './lib/response';
import publicationsRouter from './routes/publications';
import metaRouter from './routes/meta';
import searchRouter from './routes/search';
import refreshRouter from './routes/refresh';
import rawData from './data/publications.raw.json';

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

// NOTE: /api/publications/meta MUST be registered before /api/publications
// to prevent Express matching "meta" as a dynamic :id segment.
app.use('/api/publications/meta', metaRouter);
app.use('/api/publications', publicationsRouter);
app.use('/api/search', searchRouter);
app.use('/api/refresh', refreshRouter);

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
    // Parse and validate raw JSON at the boundary using Zod —
    // catches malformed seed data before it reaches any service
    const raw = parseRawPublications(rawData);
    console.log(`[Bootstrap] Loaded ${raw.length} raw publications from seed file`);

    // Deleted docs design decision:
    // All docs (including deleted) are loaded into the vector store.
    // The publications list endpoint returns all (AC requirement).
    // Deleted docs are EXCLUDED from standard search results by default.
    // They are only included when the frontend sends { includeDeleted: true }
    // via the "Search in Recycle Bin" toggle — see searchService.ts.
    const deletedCount = raw.filter((d) => d.status === 'deleted').length;
    console.log(
      `[Bootstrap] Status breakdown: ` +
      `${raw.filter(d => d.status === 'published').length} published, ` +
      `${raw.filter(d => d.status === 'draft').length} draft, ` +
      `${raw.filter(d => d.status === 'archived').length} archived, ` +
      `${deletedCount} deleted (excluded from search by default)`
    );

    startupStage = 'sanitising';
    const sanitiseStart = Date.now();
    const healed = await sanitizePublications(raw);
    console.log(`[Bootstrap] Sanitisation complete in ${Date.now() - sanitiseStart}ms`);

    startupStage = 'embedding';
    const embedStart = Date.now();
    await vectorStore.build(healed);
    console.log(`[Bootstrap] Embedding complete in ${Date.now() - embedStart}ms`);

    startupStage = 'ready';
    console.log('✅ Server ready — all endpoints active\n');

  } catch (err) {
    console.error('\n❌ Fatal startup error:', err);
    process.exit(1);
  }
}

bootstrap();
