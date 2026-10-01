const { spawn, spawnSync } = require('node:child_process');

const session = process.env.REPLIT_EXPO_SESSION_SECRET;
if (session) {
  // Replit's short-lived Expo CLI login is intentionally non-fatal.
  spawnSync('pnpm', ['exec', 'create-launch', 'login', '--session', session], {
    stdio: 'inherit',
  });
}

const required = ['PORT', 'REPLIT_DEV_DOMAIN'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing Expo workflow environment: ${missing.join(', ')}`);
  process.exit(1);
}

const publishableKey =
  process.env.CLERK_PUBLISHABLE_KEY ||
  process.env.VITE_CLERK_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) {
  console.error('Missing Clerk publishable key for the Ghar Sathi Expo app.');
  process.exit(1);
}

const devDomain = process.env.REPLIT_DEV_DOMAIN;
const expoPackagerDomain = process.env.REPLIT_EXPO_DEV_DOMAIN || devDomain;
const clerkProxyUrl = process.env.CLERK_PROXY_URL
  ? `https://${devDomain}${process.env.CLERK_PROXY_URL}`
  : '';
const env = {
  ...process.env,
  EXPO_PACKAGER_PROXY_URL: `https://${expoPackagerDomain}`,
  EXPO_PUBLIC_DOMAIN: devDomain,
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey,
  EXPO_PUBLIC_CLERK_PROXY_URL: clerkProxyUrl,
  REACT_NATIVE_PACKAGER_HOSTNAME: devDomain,
};
if (process.env.REPL_ID) env.EXPO_PUBLIC_REPL_ID = process.env.REPL_ID;

const expo = spawn(
  'pnpm',
  ['exec', 'expo', 'start', '--localhost', '--port', process.env.PORT],
  { stdio: 'inherit', env },
);

expo.on('error', (error) => {
  console.error(`Could not start Expo: ${error.message}`);
  process.exit(1);
});
expo.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
process.on('SIGINT', () => expo.kill('SIGINT'));
process.on('SIGTERM', () => expo.kill('SIGTERM'));