import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { safeTrim } from "@cloudagent/platform/utils";

export function compactStatusText(value, maxLength = 800) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export function runCommandStatus(command, args = ["--version"], { timeoutMs = 3000 } = {}) {
  const binary = safeTrim(command);
  if (!binary) {
    return Promise.resolve({
      ok: false,
      command: "",
      error: "No command configured.",
    });
  }

  return new Promise((resolve) => {
    const child = spawn(binary, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        command: binary,
        ...result,
      });
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      settle({
        ok: false,
        timedOut: true,
        error: `Timed out after ${timeoutMs}ms.`,
      });
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      settle({
        ok: false,
        error: error?.code === "ENOENT"
          ? `Command not found: ${binary}`
          : error?.message || `Failed to run ${binary}.`,
      });
    });
    child.on("close", (exitCode) => {
      const output = compactStatusText(stdout || stderr);
      settle({
        ok: exitCode === 0,
        exitCode,
        version: output.split(/\r?\n/).find(Boolean) || "",
        error: exitCode === 0 ? null : output || `${binary} exited with code ${exitCode}.`,
      });
    });
  });
}

export async function checkWritableDirectory(dirPath) {
  const directory = path.resolve(dirPath || process.cwd());
  const probePath = path.join(directory, `.cloudagent-write-test-${process.pid}-${Date.now()}`);
  try {
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(probePath, "ok", "utf8");
    await fs.unlink(probePath).catch(() => {});
    return {
      ok: true,
      path: directory,
      writable: true,
    };
  } catch (error) {
    return {
      ok: false,
      path: directory,
      writable: false,
      error: error?.message || "Directory is not writable.",
    };
  }
}
