const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(projectRoot, '../..');
const envFile = path.join(workspaceRoot, '.env');

if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const isReplit = Boolean(process.env.REPLIT_DEV_DOMAIN);
const demoMode = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
const legacyDomain =
  process.env.EXPO_PUBLIC_DOMAIN || process.env.REPLIT_DEV_DOMAIN;
const apiUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  (legacyDomain ? `https://${legacyDomain}` : undefined);
const publishableKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  process.env.CLERK_PUBLISHABLE_KEY ||
  process.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!demoMode && !apiUrl) {
  console.error(
    'Missing EXPO_PUBLIC_API_URL. Set it in the root .env file (for example, http://192.168.1.3:5000).',
  );
  process.exit(1);
}

if (!demoMode && !publishableKey) {
  console.error(
    'Missing Clerk publishable key. Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in the root .env file.',
  );
  process.exit(1);
}

const portValue =
  process.env.EXPO_PORT || (isReplit ? process.env.PORT : undefined) || '8081';
const port = Number(portValue);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid Expo port: ${portValue}`);
  process.exit(1);
}

const env = {
  ...process.env,
  EXPO_PUBLIC_DEMO_MODE: demoMode ? 'true' : 'false',
};

if (apiUrl) env.EXPO_PUBLIC_API_URL = apiUrl;
if (publishableKey) env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = publishableKey;

if (legacyDomain) {
  env.EXPO_PUBLIC_DOMAIN = legacyDomain;
}

const proxyUrl =
  process.env.CLERK_PROXY_URL && legacyDomain
    ? `https://${legacyDomain}${process.env.CLERK_PROXY_URL}`
    : process.env.EXPO_PUBLIC_CLERK_PROXY_URL;

if (proxyUrl) {
  env.EXPO_PUBLIC_CLERK_PROXY_URL = proxyUrl;
} else {
  delete env.EXPO_PUBLIC_CLERK_PROXY_URL;
}

if (isReplit) {
  const expoPackagerDomain =
    process.env.REPLIT_EXPO_DEV_DOMAIN || process.env.REPLIT_DEV_DOMAIN;
  env.EXPO_PACKAGER_PROXY_URL = `https://${expoPackagerDomain}`;
  env.REACT_NATIVE_PACKAGER_HOSTNAME = process.env.REPLIT_DEV_DOMAIN;
  if (process.env.REPL_ID) {
    env.EXPO_PUBLIC_REPL_ID = process.env.REPL_ID;
  }
}

const args = [
  'exec',
  'expo',
  'start',
  isReplit ? '--localhost' : '--lan',
  '--port',
  String(port),
];
const expo = spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, {
  stdio: 'inherit',
  cwd: projectRoot,
  env,
  shell: process.platform === 'win32',
});

expo.on('error', (error) => {
  console.error(`Could not start Expo: ${error.message}`);
  process.exitCode = 1;
});

expo.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!expo.killed) {
      expo.kill(signal);
    }
  });
}
