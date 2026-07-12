import fs from "fs";
import path from "path";
import { network } from "hardhat";

const DEMO_ACCOUNTS = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
];

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();
  const provider = deployer.provider;
  if (provider == null) {
    throw new Error("No provider available for deployer signer");
  }

  const providerNetwork = await provider.getNetwork();
  const networkName = providerNetwork.name;
  const chainId = Number(providerNetwork.chainId);

  console.log("Bootstrapping local Web3 stack");
  console.log("Network:", networkName, "Chain ID:", chainId);
  console.log("Deployer:", deployer.address);

  const EscrowFactory = await ethers.getContractFactory("FreelanceEscrow");
  const escrow = await EscrowFactory.deploy();
  const escrowDeployment = await escrow.deploymentTransaction()?.wait();
  const escrowAddress = await escrow.getAddress();

  const CertificateFactory = await ethers.getContractFactory("WorkCertificate");
  const certificate = await CertificateFactory.deploy();
  const certificateDeployment = await certificate.deploymentTransaction()?.wait();
  const certificateAddress = await certificate.getAddress();

  const AuditAnchorFactory = await ethers.getContractFactory("AuditAnchorRegistry");
  const auditAnchor = await AuditAnchorFactory.deploy();
  const auditAnchorDeployment = await auditAnchor.deploymentTransaction()?.wait();
  const auditAnchorAddress = await auditAnchor.getAddress();

  const TokenFactory = await ethers.getContractFactory("MockERC20");
  const token = await TokenFactory.deploy("Mock USDT", "mUSDT");
  const tokenDeployment = await token.deploymentTransaction()?.wait();
  const tokenAddress = await token.getAddress();
  const tokenDecimals = Number(await token.decimals());

  const whitelistTx = await escrow.addAllowedToken(tokenAddress);
  const whitelistReceipt = await whitelistTx.wait();

  const mintAmountHuman = "1000000";
  const mintAmount = ethers.parseUnits(mintAmountHuman, tokenDecimals);
  const mintedAccounts = [];
  for (const account of DEMO_ACCOUNTS) {
    const mintTx = await token.mint(account, mintAmount);
    const mintReceipt = await mintTx.wait();
    mintedAccounts.push({
      address: account,
      amount: mintAmountHuman,
      rawAmount: mintAmount.toString(),
      txHash: mintReceipt?.hash ?? mintTx.hash,
      blockNumber: mintReceipt?.blockNumber ?? null,
    });
  }

  const manifest = {
    network: networkName,
    chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      escrow: {
        name: "FreelanceEscrow",
        address: escrowAddress,
        txHash: escrowDeployment?.hash ?? null,
        blockNumber: escrowDeployment?.blockNumber ?? null,
      },
      certificate: {
        name: "WorkCertificate",
        address: certificateAddress,
        txHash: certificateDeployment?.hash ?? null,
        blockNumber: certificateDeployment?.blockNumber ?? null,
      },
      auditAnchor: {
        name: "AuditAnchorRegistry",
        address: auditAnchorAddress,
        txHash: auditAnchorDeployment?.hash ?? null,
        blockNumber: auditAnchorDeployment?.blockNumber ?? null,
      },
      token: {
        name: "Mock USDT",
        symbol: "mUSDT",
        address: tokenAddress,
        decimals: tokenDecimals,
        txHash: tokenDeployment?.hash ?? null,
        blockNumber: tokenDeployment?.blockNumber ?? null,
      },
    },
    setup: {
      whitelistToken: {
        token: tokenAddress,
        txHash: whitelistReceipt?.hash ?? whitelistTx.hash,
        blockNumber: whitelistReceipt?.blockNumber ?? null,
      },
      mintedAccounts,
    },
    txHashes: {
      escrowDeploy: escrowDeployment?.hash ?? null,
      certificateDeploy: certificateDeployment?.hash ?? null,
      auditAnchorDeploy: auditAnchorDeployment?.hash ?? null,
      tokenDeploy: tokenDeployment?.hash ?? null,
      whitelistToken: whitelistReceipt?.hash ?? whitelistTx.hash,
      mintDemoBalances: mintedAccounts.map((account) => account.txHash),
    },
  };

  const deploymentDir = path.resolve("deployments");
  fs.mkdirSync(deploymentDir, { recursive: true });
  const manifestPath = path.join(deploymentDir, `${networkName}-${chainId}.json`);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync("deployed_address.txt", `${escrowAddress}\n`);

  console.log("FreelanceEscrow:", escrowAddress);
  console.log("WorkCertificate:", certificateAddress);
  console.log("AuditAnchorRegistry:", auditAnchorAddress);
  console.log("mUSDT:", tokenAddress);
  console.log("Manifest:", manifestPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
