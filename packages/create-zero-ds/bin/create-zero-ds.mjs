#!/usr/bin/env node
// The published entry: `pnpm create @sigx/zero-ds …` resolves to this bin.
import { main } from '../dist/cli.js';

process.exitCode = await main(process.argv.slice(2));
