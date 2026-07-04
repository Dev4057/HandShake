// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DataOracle — a paid on-chain data source.
/// @notice Agents pay a fee to purchase the current data value. The purchase
///         emits a receipt event, which buyers use to verify PROVENANCE:
///         "did the seller really buy this data, and does the delivered number
///         match what the oracle said?"
contract DataOracle {
    address public owner;
    uint256 public fee;        // price per purchase, in wei
    uint256 private value;     // the data (e.g. BTC/USD in cents)
    uint256 public updatedAt;

    event DataPurchased(address indexed buyer, uint256 value, uint256 paid);

    constructor(uint256 _fee, uint256 _value) {
        owner = msg.sender;
        fee = _fee;
        value = _value;
        updatedAt = block.timestamp;
    }

    /// @notice Owner refreshes the data value.
    function setValue(uint256 v) external {
        require(msg.sender == owner, "only owner");
        value = v;
        updatedAt = block.timestamp;
    }

    /// @notice Pay the fee, get the data. The event is the purchase receipt.
    function purchase() external payable returns (uint256) {
        require(msg.value >= fee, "fee not paid");
        emit DataPurchased(msg.sender, value, msg.value);
        return value;
    }

    function withdraw() external {
        require(msg.sender == owner, "only owner");
        (bool ok, ) = payable(owner).call{value: address(this).balance}("");
        require(ok, "withdraw failed");
    }
}
