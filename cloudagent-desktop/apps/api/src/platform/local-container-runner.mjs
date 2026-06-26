import { spawn, spawnSync } from "node:child_process";

function hasCommand(command) {
  const result = spawnSync(command, ["--version"], {
    stdio: "ignore",
    shell: false,
  });
  return result.status === 0;
}

export function detectLocalContainerRuntime() {
  if (hasCommand("docker")) return "docker";
  if (hasCommand("podman")) return "podman";
  return null;
}

export async function runLocalScannerContainer({
  image,
  env = {},
  args = [],
  timeoutMs = Number(process.env.CLOUDAGENT_LOCAL_SCANNER_TIMEOUT_MS || 30 * 60 * 1000),
  runtime = process.env.CLOUDAGENT_LOCAL_CONTAINER_RUNTIME || detectLocalContainerRuntime(),
  logger = console,
} = {}) {
  if (!runtime) {
    throw new Error("No local container runtime was found. Install Docker or Podman, or use process mode.");
  }
  if (!image) {
    throw new Error("Container image is required");
  }

  const runtimeArgs = [
    "run",
    "--rm",
    ...Object.entries(env)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .flatMap(([key, value]) => ["-e", `${key}=${value}`]),
    image,
    ...args,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(runtime, runtimeArgs, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr?.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const result = {
        code,
        signal,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };
      if (code === 0) return resolve(result);
      logger?.warn?.("[local-container-runner] container exited non-zero", {
        runtime,
        image,
        code,
        signal,
      });
      const error = new Error(`Container exited with code ${code ?? signal ?? "unknown"}`);
      error.result = result;
      reject(error);
    });
  });
}
