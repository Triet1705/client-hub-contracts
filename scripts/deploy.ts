import fs from "fs";
import { ethers } from "ethers";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // Read ABI and Bytecode from artifacts
  const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/FreelanceEscrow.sol/FreelanceEscrow.json", "utf8"));
  
  const FreelanceEscrowFactory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
  const escrow = await FreelanceEscrowFactory.deploy();
  await escrow.waitForDeployment();

  const escrowAddress = await escrow.getAddress();
  console.log("FreelanceEscrow deployed to:", escrowAddress);
  
  // Write address out to a file for reference
  fs.writeFileSync("deployed_address.txt", escrowAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
