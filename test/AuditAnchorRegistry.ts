import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("AuditAnchorRegistry", function () {
  const root = `0x${"11".repeat(32)}`;
  const metadataHash = `0x${"22".repeat(32)}`;
  let registry: any;
  let owner: any;
  let other: any;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("AuditAnchorRegistry");
    registry = await factory.deploy();
    await registry.waitForDeployment();
  });

  it("anchors and exposes a root", async function () {
    await expect(registry.anchorRoot(root, 3, metadataHash))
      .to.emit(registry, "AuditRootAnchored");

    const anchor = await registry.anchors(root);
    expect(anchor.recordCount).to.equal(3n);
    expect(anchor.metadataHash).to.equal(metadataHash);
    expect(anchor.submitter).to.equal(owner.address);
    expect(await registry.isAnchored(root)).to.equal(true);
  });

  it("rejects unauthorized submissions", async function () {
    await expect(registry.connect(other).anchorRoot(root, 1, metadataHash))
      .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount")
      .withArgs(other.address);
  });

  it("rejects invalid and duplicate roots", async function () {
    await expect(registry.anchorRoot(ethers.ZeroHash, 1, metadataHash))
      .to.be.revertedWithCustomError(registry, "InvalidRoot");
    await expect(registry.anchorRoot(root, 0, metadataHash))
      .to.be.revertedWithCustomError(registry, "EmptyBatch");

    await registry.anchorRoot(root, 1, metadataHash);
    await expect(registry.anchorRoot(root, 1, metadataHash))
      .to.be.revertedWithCustomError(registry, "RootAlreadyAnchored")
      .withArgs(root);
  });

  it("blocks submissions while paused", async function () {
    await registry.pause();
    await expect(registry.anchorRoot(root, 1, metadataHash))
      .to.be.revertedWithCustomError(registry, "EnforcedPause");
    await registry.unpause();
    await expect(registry.anchorRoot(root, 1, metadataHash)).to.emit(registry, "AuditRootAnchored");
  });
});
