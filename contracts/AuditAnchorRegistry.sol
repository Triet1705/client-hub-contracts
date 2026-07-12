// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract AuditAnchorRegistry is Ownable, Pausable {
    struct Anchor {
        uint256 recordCount;
        bytes32 metadataHash;
        uint256 anchoredAt;
        address submitter;
    }

    mapping(bytes32 => Anchor) public anchors;

    event AuditRootAnchored(
        bytes32 indexed root,
        uint256 recordCount,
        bytes32 indexed metadataHash,
        uint256 anchoredAt,
        address indexed submitter
    );

    error InvalidRoot();
    error EmptyBatch();
    error RootAlreadyAnchored(bytes32 root);

    constructor() Ownable(msg.sender) {}

    function anchorRoot(bytes32 root, uint256 recordCount, bytes32 metadataHash)
        external
        onlyOwner
        whenNotPaused
    {
        if (root == bytes32(0)) revert InvalidRoot();
        if (recordCount == 0) revert EmptyBatch();
        if (anchors[root].anchoredAt != 0) revert RootAlreadyAnchored(root);

        anchors[root] = Anchor({
            recordCount: recordCount,
            metadataHash: metadataHash,
            anchoredAt: block.timestamp,
            submitter: msg.sender
        });

        emit AuditRootAnchored(root, recordCount, metadataHash, block.timestamp, msg.sender);
    }

    function isAnchored(bytes32 root) external view returns (bool) {
        return anchors[root].anchoredAt != 0;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
