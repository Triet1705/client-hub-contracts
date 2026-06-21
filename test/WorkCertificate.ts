import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("WorkCertificate", function () {
  let workCertificate: any;
  let owner: any;
  let freelancer: any;
  let otherAccount: any;

  const metadataURI = "ipfs://QmTestHash123/metadata.json";

  beforeEach(async function () {
    [owner, freelancer, otherAccount] = await ethers.getSigners();
    
    const WorkCertificateFactory = await ethers.getContractFactory("WorkCertificate");
    workCertificate = await WorkCertificateFactory.deploy();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await workCertificate.owner()).to.equal(owner.address);
    });

    it("Should have correct name and symbol", async function () {
      expect(await workCertificate.name()).to.equal("ClientHub Work Certificate");
      expect(await workCertificate.symbol()).to.equal("CHWC");
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint certificate", async function () {
      await expect(workCertificate.mintCertificate(freelancer.address, metadataURI))
        .to.emit(workCertificate, "Transfer")
        .withArgs(ethers.ZeroAddress, freelancer.address, 0)
        .and.to.emit(workCertificate, "Locked")
        .withArgs(0);

      expect(await workCertificate.ownerOf(0)).to.equal(freelancer.address);
      expect(await workCertificate.tokenURI(0)).to.equal(metadataURI);
    });

    it("Should prevent non-owner from minting", async function () {
      await expect(
        workCertificate.connect(freelancer).mintCertificate(freelancer.address, metadataURI)
      ).to.be.revertedWithCustomError(workCertificate, "OwnableUnauthorizedAccount");
    });
  });

  describe("Soulbound functionality (EIP-5192)", function () {
    beforeEach(async function () {
      await workCertificate.mintCertificate(freelancer.address, metadataURI);
    });

    it("Should return true for locked status", async function () {
      expect(await workCertificate.locked(0)).to.be.true;
    });

    it("Should revert on attempt to transfer", async function () {
      await expect(
        workCertificate.connect(freelancer).transferFrom(freelancer.address, otherAccount.address, 0)
      ).to.be.revertedWith("WorkCertificate: Tokens are soulbound and non-transferable");
    });

    it("Should support EIP-5192 interface", async function () {
      // 0xb45a3c0e is the interface ID for EIP-5192
      expect(await workCertificate.supportsInterface("0xb45a3c0e")).to.be.true;
    });

    it("Should allow owner to burn a certificate", async function () {
      await expect(workCertificate.burn(0))
        .to.emit(workCertificate, "Transfer")
        .withArgs(freelancer.address, ethers.ZeroAddress, 0);

      await expect(workCertificate.ownerOf(0))
        .to.be.revertedWithCustomError(workCertificate, "ERC721NonexistentToken");
    });
  });
});
