import fs from "fs";
import path from "path";

type Manifest = {
  contracts: {
    escrow: { address: string };
    auditAnchor: { address: string };
    token: { address: string; decimals: number };
  };
};

function readManifest(manifestPath: string): Manifest {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Deployment manifest not found: ${manifestPath}`);
  }
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;
}

function updateEnvFile(filePath: string, updates: Record<string, string>) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const lines = existing.length > 0 ? existing.split(/\r?\n/) : [];
  const seen = new Set<string>();

  const nextLines = lines.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match) {
      return line;
    }

    const key = match[1];
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      seen.add(key);
      return `${key}=${updates[key]}`;
    }
    return line;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) {
      nextLines.push(`${key}=${value}`);
    }
  }

  fs.writeFileSync(filePath, `${nextLines.filter((line, index) => line.length > 0 || index < nextLines.length - 1).join("\n")}\n`);
}

const manifestPath = path.resolve(process.argv[2] ?? path.join("deployments", "localhost-31337.json"));
const projectRoot = path.resolve("..");
const manifest = readManifest(manifestPath);

const escrowAddress = manifest.contracts.escrow.address;
const auditAnchorAddress = manifest.contracts.auditAnchor.address;
const tokenAddress = manifest.contracts.token.address;
const tokenDecimals = String(manifest.contracts.token.decimals);

const backendEnvPath = path.join(projectRoot, "client-hub-backend", ".env");
const frontendEnvPath = path.join(projectRoot, "client-hub-frontend", ".env.local");

updateEnvFile(backendEnvPath, {
  ESCROW_CONTRACT_ADDRESS: escrowAddress,
  ESCROW_TOKEN_ADDRESS: tokenAddress,
  ESCROW_TOKEN_DECIMALS: tokenDecimals,
  AUDIT_ANCHOR_CONTRACT_ADDRESS: auditAnchorAddress,
  AUDIT_ANCHOR_ENABLED: "true",
  AUDIT_ANCHOR_BATCH_SIZE: "1",
  AUDIT_ANCHOR_SCHEDULER_DELAY_MS: "10000",
  BLOCKCHAIN_REQUIRED_CONFIRMATIONS: "1",
});

updateEnvFile(frontendEnvPath, {
  NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS: escrowAddress,
  NEXT_PUBLIC_ESCROW_TOKEN_ADDRESS: tokenAddress,
  NEXT_PUBLIC_ESCROW_TOKEN_DECIMALS: tokenDecimals,
});

console.log("Synced local Web3 env values");
console.log("Backend:", backendEnvPath);
console.log("Frontend:", frontendEnvPath);
