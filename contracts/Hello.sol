// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Hello — throwaway contract to prove the Monad toolchain works.
/// @dev Phase 0.5 spike only. Real escrow/reputation contract comes in Phase 4.
contract Hello {
    string public message;
    uint256 public pings;

    event Pinged(address indexed from, uint256 total);

    constructor(string memory _message) {
        message = _message;
    }

    /// @notice write path — change the stored message.
    function setMessage(string calldata _message) external {
        message = _message;
    }

    /// @notice write path — bump a counter and emit an event.
    function ping() external {
        pings += 1;
        emit Pinged(msg.sender, pings);
    }
}
