// Register tsconfig path aliases at runtime BEFORE loading any app code.
// Vercel's bundler does not resolve @/ aliases from tsconfig.json so we
// patch Node's module resolver here. Must use require() — not import —
// because ES module imports are hoisted and would load src/app before
// register() runs.
/* eslint-disable @typescript-eslint/no-require-imports */
const tsconfigPaths = require('tsconfig-paths');
const path = require('path');

tsconfigPaths.register({
  baseUrl: path.resolve(__dirname, '..'),
  paths: { '@/*': ['./src/*'] },
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createApp } = require('../src/app');

/**
 * Vercel serverless entry point.
 *
 * Vercel looks for a default export from api/index.ts and wraps it as a
 * serverless function. All requests are routed here via vercel.json rewrites.
 *
 * Do NOT use src/server.ts as the Vercel entry — that file calls app.listen()
 * which is not compatible with the serverless runtime.
 */
const app = createApp();

export default app;
