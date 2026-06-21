import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("FreelanceEscrow", function () {
  let escrow: any;
  let mockToken: any;
  let owner: any;
  let client: any;
  let freelancer: any;
  let otherAccount: any;

  const INVOICE_ID = 1;
  const DEPOSIT_AMOUNT = ethers.parseUnits("100", 18);

  beforeEach(async function () {
    [owner, client, freelancer, otherAccount] = await ethers.getSigners();

    // Deploy Mock ERC20
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20Factory.deploy("Mock USDT", "USDT");
    await mockToken.waitForDeployment();

    // Deploy Escrow
    const EscrowFactory = await ethers.getContractFactory("FreelanceEscrow");
    escrow = await EscrowFactory.deploy();
    await escrow.waitForDeployment();

    // Setup
    await escrow.addAllowedToken(await mockToken.getAddress());
    
    // Mint tokens to client and approve escrow contract
    await mockToken.mint(client.address, ethers.parseUnits("1000", 18));
    await mockToken.connect(client).approve(await escrow.getAddress(), ethers.MaxUint256);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await escrow.owner()).to.equal(owner.address);
    });

    it("Should whitelist the mock token", async function () {
      expect(await escrow.allowedTokens(await mockToken.getAddress())).to.be.true;
    });

    it("Should reject zero address token whitelist", async function () {
      await expect(escrow.addAllowedToken(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid token address");
    });
  });

  describe("Deposit", function () {
    it("Should allow client to deposit funds", async function () {
      await expect(
        escrow.connect(client).deposit(
          INVOICE_ID,
          await mockToken.getAddress(),
          DEPOSIT_AMOUNT,
          freelancer.address
        )
      )
        .to.emit(escrow, "Deposited")
        .withArgs(INVOICE_ID, await mockToken.getAddress(), DEPOSIT_AMOUNT, client.address, freelancer.address);

      const escrowData = await escrow.escrows(INVOICE_ID);
      expect(escrowData.status).to.equal(1n); // DEPOSITED
      expect(escrowData.amount).to.equal(DEPOSIT_AMOUNT);
      
      const contractBalance = await mockToken.balanceOf(await escrow.getAddress());
      expect(contractBalance).to.equal(DEPOSIT_AMOUNT);
    });

    it("Should fail if token is not whitelisted", async function () {
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      const unwhitelistedToken = await MockERC20Factory.deploy("Fake", "FAKE");
      
      await expect(
        escrow.connect(client).deposit(INVOICE_ID, await unwhitelistedToken.getAddress(), DEPOSIT_AMOUNT, freelancer.address)
      ).to.be.revertedWith("Token not whitelisted");
    });

    it("Should fail on zero amount", async function () {
      await expect(
        escrow.connect(client).deposit(INVOICE_ID, await mockToken.getAddress(), 0, freelancer.address)
      ).to.be.revertedWith("Amount must be positive");
    });

    it("Should reject duplicate deposits for the same invoice", async function () {
      await escrow.connect(client).deposit(INVOICE_ID, await mockToken.getAddress(), DEPOSIT_AMOUNT, freelancer.address);

      await expect(
        escrow.connect(client).deposit(INVOICE_ID, await mockToken.getAddress(), DEPOSIT_AMOUNT, freelancer.address)
      ).to.be.revertedWith("Already deposited");
    });
  });

  describe("Release", function () {
    beforeEach(async function () {
      await escrow.connect(client).deposit(INVOICE_ID, await mockToken.getAddress(), DEPOSIT_AMOUNT, freelancer.address);
    });

    it("Should allow client to release funds to freelancer", async function () {
      const initialBalance = await mockToken.balanceOf(freelancer.address);
      
      await expect(escrow.connect(client).release(INVOICE_ID))
        .to.emit(escrow, "Released")
        .withArgs(INVOICE_ID, freelancer.address, await mockToken.getAddress(), DEPOSIT_AMOUNT);

      const escrowData = await escrow.escrows(INVOICE_ID);
      expect(escrowData.status).to.equal(2n); // RELEASED
      
      const finalBalance = await mockToken.balanceOf(freelancer.address);
      expect(finalBalance - initialBalance).to.equal(DEPOSIT_AMOUNT);
    });

    it("Should fail if non-client tries to release", async function () {
      await expect(escrow.connect(freelancer).release(INVOICE_ID))
        .to.be.revertedWith("Unauthorized");
    });
  });

  describe("Refund", function () {
    beforeEach(async function () {
      await escrow.connect(client).deposit(INVOICE_ID, await mockToken.getAddress(), DEPOSIT_AMOUNT, freelancer.address);
    });

    it("Should allow client to refund funds", async function () {
      const initialBalance = await mockToken.balanceOf(client.address);
      
      await expect(escrow.connect(client).refund(INVOICE_ID))
        .to.emit(escrow, "Refunded")
        .withArgs(INVOICE_ID, client.address, await mockToken.getAddress(), DEPOSIT_AMOUNT);

      const escrowData = await escrow.escrows(INVOICE_ID);
      expect(escrowData.status).to.equal(3n); // REFUNDED
      
      const finalBalance = await mockToken.balanceOf(client.address);
      expect(finalBalance - initialBalance).to.equal(DEPOSIT_AMOUNT);
    });
  });

  describe("Admin Resolve", function () {
    beforeEach(async function () {
      await escrow.connect(client).deposit(INVOICE_ID, await mockToken.getAddress(), DEPOSIT_AMOUNT, freelancer.address);
    });

    it("Should allow admin to resolve dispute in favor of freelancer", async function () {
      const initialBalance = await mockToken.balanceOf(freelancer.address);
      
      await expect(escrow.connect(owner).adminResolve(INVOICE_ID, true))
        .to.emit(escrow, "DisputeResolved")
        .withArgs(INVOICE_ID, true);

      const finalBalance = await mockToken.balanceOf(freelancer.address);
      expect(finalBalance - initialBalance).to.equal(DEPOSIT_AMOUNT);
    });

    it("Should allow admin to resolve dispute in favor of client", async function () {
      const initialBalance = await mockToken.balanceOf(client.address);
      
      await expect(escrow.connect(owner).adminResolve(INVOICE_ID, false))
        .to.emit(escrow, "DisputeResolved")
        .withArgs(INVOICE_ID, false);

      const finalBalance = await mockToken.balanceOf(client.address);
      expect(finalBalance - initialBalance).to.equal(DEPOSIT_AMOUNT);
    });

    it("Should fail if non-admin tries to resolve", async function () {
      await expect(
        escrow.connect(otherAccount).adminResolve(INVOICE_ID, true)
      )
        .to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount")
        .withArgs(otherAccount.address);
    });
  });

  describe("Pause controls", function () {
    it("Should block deposit, release, refund, and adminResolve while paused", async function () {
      await escrow.connect(client).deposit(INVOICE_ID, await mockToken.getAddress(), DEPOSIT_AMOUNT, freelancer.address);
      await escrow.pause();

      await expect(
        escrow.connect(client).deposit(2, await mockToken.getAddress(), DEPOSIT_AMOUNT, freelancer.address)
      ).to.be.revertedWithCustomError(escrow, "EnforcedPause");

      await expect(escrow.connect(client).release(INVOICE_ID))
        .to.be.revertedWithCustomError(escrow, "EnforcedPause");

      await expect(escrow.connect(client).refund(INVOICE_ID))
        .to.be.revertedWithCustomError(escrow, "EnforcedPause");

      await expect(escrow.adminResolve(INVOICE_ID, true))
        .to.be.revertedWithCustomError(escrow, "EnforcedPause");

      await escrow.unpause();
      await expect(escrow.connect(client).release(INVOICE_ID))
        .to.emit(escrow, "Released");
    });
  });
});
