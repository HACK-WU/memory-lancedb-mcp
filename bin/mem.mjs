#!/usr/bin/env node
// CLI entry point for 'mem' command
import("../dist/cli.js").catch((err) => {
  console.error("Failed to load mem CLI. Did you run 'npm run build'?");
  console.error(err.message);
  process.exit(1);
});
