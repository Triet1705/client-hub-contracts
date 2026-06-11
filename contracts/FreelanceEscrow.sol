// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract FreelanceEscrow is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    enum EscrowStatus { NOT_STARTED, DEPOSITED, RELEASED, REFUNDED }

    struct Escrow {
        address client;
        address freelancer;
        address token;  // Which token was deposited (USDT/USDC)
        uint256 amount;
        EscrowStatus status;
    }

    mapping(uint256 => Escrow) public escrows;
    mapping(address => bool) public allowedTokens;

    event Deposited(uint256 indexed invoiceId, address token, uint256 amount, address client, address freelancer);
    event Released(uint256 indexed invoiceId, address freelancer, address token, uint256 amount);
    event Refunded(uint256 indexed invoiceId, address client, address token, uint256 amount);
    event DisputeResolved(uint256 indexed invoiceId, bool releasedToFreelancer);
    event TokenWhitelisted(address token);

    constructor() Ownable(msg.sender) {
    }

    function addAllowedToken(address _token) external onlyOwner {
        require(_token != address(0), "Invalid token address");
        allowedTokens[_token] = true;
        emit TokenWhitelisted(_token);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function deposit(uint256 invoiceId, address token, uint256 amount, address freelancer) external nonReentrant whenNotPaused {
        // Checks
        require(allowedTokens[token], "Token not whitelisted");
        require(amount > 0, "Amount must be positive");
        require(escrows[invoiceId].status == EscrowStatus.NOT_STARTED, "Already deposited");
        require(freelancer != address(0), "Invalid freelancer address");

        // Effects
        escrows[invoiceId] = Escrow({
            client: msg.sender,
            freelancer: freelancer,
            token: token,
            amount: amount,
            status: EscrowStatus.DEPOSITED
        });

        // Interactions
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(invoiceId, token, amount, msg.sender, freelancer);
    }

    function release(uint256 invoiceId) external nonReentrant whenNotPaused {
        // Checks
        require(escrows[invoiceId].status == EscrowStatus.DEPOSITED, "No funds or already processed");
        require(msg.sender == escrows[invoiceId].client, "Unauthorized");

        // Effects
        Escrow storage escrow = escrows[invoiceId];
        escrow.status = EscrowStatus.RELEASED;
        uint256 amount = escrow.amount;
        address token = escrow.token;
        address freelancer = escrow.freelancer;

        // Interactions
        IERC20(token).safeTransfer(freelancer, amount);
        emit Released(invoiceId, freelancer, token, amount);
    }

    function refund(uint256 invoiceId) external nonReentrant whenNotPaused {
        // Checks
        require(escrows[invoiceId].status == EscrowStatus.DEPOSITED, "No funds or already processed");
        require(msg.sender == escrows[invoiceId].client, "Unauthorized");

        // Effects
        Escrow storage escrow = escrows[invoiceId];
        escrow.status = EscrowStatus.REFUNDED;
        uint256 amount = escrow.amount;
        address token = escrow.token;
        address client = escrow.client;

        // Interactions
        IERC20(token).safeTransfer(client, amount);
        emit Refunded(invoiceId, client, token, amount);
    }

    function adminResolve(uint256 invoiceId, bool releaseToFreelancer) external onlyOwner nonReentrant whenNotPaused {
        require(escrows[invoiceId].status == EscrowStatus.DEPOSITED, "No funds or already processed");
        
        Escrow storage escrow = escrows[invoiceId];
        uint256 amount = escrow.amount;
        address token = escrow.token;
        
        if (releaseToFreelancer) {
            escrow.status = EscrowStatus.RELEASED;
            address freelancer = escrow.freelancer;
            IERC20(token).safeTransfer(freelancer, amount);
            emit Released(invoiceId, freelancer, token, amount);
        } else {
            escrow.status = EscrowStatus.REFUNDED;
            address client = escrow.client;
            IERC20(token).safeTransfer(client, amount);
            emit Refunded(invoiceId, client, token, amount);
        }
        
        emit DisputeResolved(invoiceId, releaseToFreelancer);
    }

    function getEscrowStatus(uint256 invoiceId) external view returns (EscrowStatus) {
        return escrows[invoiceId].status;
    }
}
