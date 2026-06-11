import fs from "fs";
import { ethers } from "ethers";

/**
 * Setup dev environment:
 * 1. Deploy MockERC20
 * 2. Whitelist it in FreelanceEscrow
 * 3. Mint tokens to test accounts
 *
 * Uses manual nonce tracking to avoid Hardhat automining race.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const provider = deployer.provider;

  console.log("Using deployer account:", deployer.address);

  // Track nonce manually
  let nonce = await provider.getTransactionCount(deployer.address, "latest");
  console.log("Starting nonce:", nonce);

  // ── 1. Load deployed FreelanceEscrow ───────────────────────────────────
  const escrowAddress = fs.readFileSync("deployed_address.txt", "utf8").trim();
  const escrowArtifact = JSON.parse(
    fs.readFileSync("./artifacts/contracts/FreelanceEscrow.sol/FreelanceEscrow.json", "utf8"),
  );
  const escrow = new ethers.Contract(escrowAddress, escrowArtifact.abi, deployer);
  console.log("FreelanceEscrow loaded at:", escrowAddress);

  // ── 2. Deploy MockERC20 ────────────────────────────────────────────────
  const tokenArtifact = JSON.parse(
    fs.readFileSync("./artifacts/contracts/test/MockERC20.sol/MockERC20.json", "utf8"),
  );
  const TokenFactory = new ethers.ContractFactory(tokenArtifact.abi, tokenArtifact.bytecode, deployer);
  const token = await TokenFactory.deploy("Mock USDT", "mUSDT", { nonce: nonce++ });
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("MockERC20 (mUSDT) deployed to:", tokenAddress);

  // ── 3. Whitelist token ─────────────────────────────────────────────────
  const wlTx = await escrow.addAllowedToken(tokenAddress, { nonce: nonce++ });
  await wlTx.wait();
  console.log("Token whitelisted in FreelanceEscrow ✅");

  // ── 4. Mint tokens ─────────────────────────────────────────────────────
  const mintAmount = ethers.parseUnits("1000000", 18);
  const accounts = [
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  ];

  const tokenContract = token as ethers.Contract;
  for (const account of accounts) {
    const tx = await tokenContract.mint(account, mintAmount, { nonce: nonce++ });
    await tx.wait();
    console.log(`Minted 1,000,000 mUSDT to ${account}`);
  }

  // ── 5. Summary ─────────────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════════════");
  console.log("  DEV SETUP COMPLETE");
  console.log("════════════════════════════════════════════════");
  console.log(`  Escrow Contract : ${escrowAddress}`);
  console.log(`  Mock USDT Token : ${tokenAddress}`);
  console.log(`  Token Decimals  : 18`);
  console.log("════════════════════════════════════════════════");
  console.log("\nAdd these to client-hub-frontend/.env.local:\n");
  console.log(`NEXT_PUBLIC_BLOCKCHAIN_ENABLED=true`);
  console.log(`NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=${escrowAddress}`);
  console.log(`NEXT_PUBLIC_ESCROW_TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`NEXT_PUBLIC_ESCROW_TOKEN_DECIMALS=18`);
  console.log("");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
