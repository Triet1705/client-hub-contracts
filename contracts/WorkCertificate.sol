// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title WorkCertificate
 * @dev Implementation of an ERC-721 Soulbound Token (SBT) representing a completed work project.
 * Adheres to EIP-5192 specification for Soulbound Tokens.
 */
contract WorkCertificate is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    // EIP-5192 Event
    event Locked(uint256 tokenId);

    constructor() ERC721("ClientHub Work Certificate", "CHWC") Ownable(msg.sender) {}

    /**
     * @dev Mints a new Soulbound Token certificate to a freelancer
     * @param freelancer Address of the freelancer receiving the certificate
     * @param metadataURI IPFS URI containing the certificate metadata
     * @return The newly minted token ID
     */
    function mintCertificate(address freelancer, string memory metadataURI) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(freelancer, tokenId);
        _setTokenURI(tokenId, metadataURI);
        
        // Emit EIP-5192 Locked event as it's soulbound from mint
        emit Locked(tokenId);
        
        return tokenId;
    }

    /**
     * @dev Required by EIP-5192. Returns whether the token is locked (soulbound).
     * Since all tokens in this contract are permanently soulbound, this always returns true.
     */
    function locked(uint256 /* tokenId */) external pure returns (bool) {
        return true;
    }

    /**
     * @dev Overrides transfer functionality to make the token soulbound
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721)
        returns (address)
    {
        address from = _ownerOf(tokenId);
        
        // Allow minting (from == 0) and burning (to == 0) but prevent any other transfers
        require(from == address(0) || to == address(0), "WorkCertificate: Tokens are soulbound and non-transferable");
        
        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Burns a Soulbound Token
     * @param tokenId The ID of the token to be burned
     */
    function burn(uint256 tokenId) external onlyOwner {
        _burn(tokenId);
    }

    // The following functions are overrides required by Solidity for multiple inheritance

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        // Add EIP-5192 interface support (0xb45a3c0e)
        return interfaceId == bytes4(0xb45a3c0e) || super.supportsInterface(interfaceId);
    }
}
