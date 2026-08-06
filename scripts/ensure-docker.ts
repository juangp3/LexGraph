import { execFileSync } from "node:child_process";

function printHelpAndExit(message: string): never {
  console.error(message);
  console.error("");
  console.error("Start Docker Desktop, then retry npm run start:full.");
  console.error("If Docker is already running, check docker context ls and docker context use default.");
  process.exit(1);
}

try {
  execFileSync("docker", ["info"], { stdio: "ignore" });
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  printHelpAndExit(
    `Docker is not reachable from this shell. The compose stack cannot start until the Docker engine is running.\n${detail}`
  );
}

console.log("Docker is available.");