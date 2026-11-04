import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = fileURLToPath(new URL('..', import.meta.url));

for (const lockfile of ['package-lock.json', 'yarn.lock']) {
  const lockfilePath = resolve(workspaceRoot, lockfile);
  if (existsSync(lockfilePath)) {
    rmSync(lockfilePath);
  }
}

if (!process.env.npm_config_user_agent?.startsWith('pnpm/')) {
  console.error('Use pnpm instead.');
  process.exit(1);
}
