import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["node_modules/hardhat/dist/src/cli.js", "test"], {
  encoding: "utf8",
});

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const passingCounts = [...output.matchAll(/(\d+)\s+passing\b/g)]
  .map((match) => Number(match[1]))
  .filter((count) => Number.isFinite(count));
const passingCount = passingCounts.reduce((total, count) => total + count, 0);

if (!Number.isFinite(passingCount) || passingCount <= 0) {
  console.error("Hardhat test gate failed: expected at least one passing test.");
  process.exit(1);
}
