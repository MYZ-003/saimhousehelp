import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const workspaceRoot = path.resolve(projectRoot, "../..");
const envFile = path.join(workspaceRoot, ".env");

if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const port = process.env.API_PORT || process.env.PORT || "5000";
const env = {
  ...process.env,
  NODE_ENV: "development",
  PORT: port,
  API_HOST: process.env.API_HOST || "0.0.0.0",
};

const build = spawnSync(process.execPath, ["./build.mjs"], {
  cwd: projectRoot,
  env,
  stdio: "inherit",
});

if (build.error) {
  console.error(`Could not build the API server: ${build.error.message}`);
  process.exit(1);
}

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const server = spawn(
  process.execPath,
  ["--enable-source-maps", "./dist/index.mjs"],
  {
    cwd: projectRoot,
    env,
    stdio: "inherit",
  },
);

server.on("error", (error) => {
  console.error(`Could not start the API server: ${error.message}`);
  process.exitCode = 1;
});

server.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!server.killed) {
      server.kill(signal);
    }
  });
}
