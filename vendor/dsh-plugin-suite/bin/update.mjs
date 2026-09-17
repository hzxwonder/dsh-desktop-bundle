#!/usr/bin/env node
// Kept as a compatibility entry point for existing maintenance scripts.
import {main} from './manage.mjs';

process.argv.splice(2, 0, 'update');
process.exitCode = await main(process.argv.slice(2));
