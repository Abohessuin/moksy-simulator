#!/usr/bin/env node

import { runCli } from '../dist/cli.js';

runCli().catch((err) => {
  console.error('[Moksy Fatal Error]:', err?.message || err);
  process.exit(1);
});
