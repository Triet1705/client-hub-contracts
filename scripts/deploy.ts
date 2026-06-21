import fs from "fs";
import path from "path";
import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();
  const provider = deployer.provider;
  if (provider == null) {
    throw new Error("No provider available for deployer signer");
  }
  const hardhatNetworkName = (await provider.getNetwork()).name;
  const chainId = Number((await provider.getNetwork()).chainId);

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Network:", hardhatNetworkName, "Chain ID:", chainId);

  const EscrowFactory = await ethers.getContractFactory("FreelanceEscrow");
  const escrow = await EscrowFactory.deploy();
  const escrowDeployment = await escrow.deploymentTransaction()?.wait();

  const escrowAddress = await escrow.getAddress();
  console.log("FreelanceEscrow deployed to:", escrowAddress);

  const CertificateFactory = await ethers.getContractFactory("WorkCertificate");
  const certificate = await CertificateFactory.deploy();
  const certificateDeployment = await certificate.deploymentTransaction()?.wait();

  const certificateAddress = await certificate.getAddress();
  console.log("WorkCertificate deployed to:", certificateAddress);

  const deploymentRecord = {
    network: hardhatNetworkName,
    chainId,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      FreelanceEscrow: {
        address: escrowAddress,
        transactionHash: escrowDeployment?.hash ?? null,
        blockNumber: escrowDeployment?.blockNumber ?? null,
        verified: false,
      },
      WorkCertificate: {
        address: certificateAddress,
        transactionHash: certificateDeployment?.hash ?? null,
        blockNumber: certificateDeployment?.blockNumber ?? null,
        verified: false,
      },
    },
  };

  const deploymentDir = path.resolve("deployments");
  fs.mkdirSync(deploymentDir, { recursive: true });
  fs.writeFileSync(
    path.join(deploymentDir, `${hardhatNetworkName}-${chainId}.json`),
    `${JSON.stringify(deploymentRecord, null, 2)}\n`,
  );

  fs.writeFileSync("deployed_address.txt", `${escrowAddress}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
