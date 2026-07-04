// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HandshakeEscrowV2} from "../contracts/HandshakeEscrowV2.sol";

/// @dev A bonder that reverts on receive — the V1 settlement-griefing vector.
contract RevertingBonder {
    function bond(HandshakeEscrowV2 esc, bytes32 jobId) external payable {
        esc.postBond{value: msg.value}(jobId);
    }
    receive() external payable {
        revert("nope");
    }
}

contract HandshakeEscrowV2Test is Test {
    HandshakeEscrowV2 esc;
    address buyer = makeAddr("buyer");
    address pixel = makeAddr("PixelPro");
    address cheap = makeAddr("CheapBot");
    address treasury = makeAddr("treasury");
    bytes32 constant JOB = keccak256("job-1");
    uint64 deadline;

    function setUp() public {
        esc = new HandshakeEscrowV2(treasury);
        vm.deal(buyer, 100 ether);
        vm.deal(pixel, 10 ether);
        vm.deal(cheap, 10 ether);
        deadline = uint64(block.timestamp + 1 days);
    }

    function _open(uint256 budget) internal {
        vm.prank(buyer);
        esc.openJob{value: budget}(JOB, deadline);
    }

    function _bond(address who, uint256 amt) internal {
        vm.prank(who);
        esc.postBond{value: amt}(JOB);
    }

    function _withdraw(address who) internal {
        vm.prank(who);
        esc.withdraw();
    }

    function test_OpenLocksBudgetWithDeadline() public {
        _open(5 ether);
        (address b, uint256 budget, uint64 dl,, bool settled, uint256 count) = esc.getJob(JOB);
        assertEq(b, buyer);
        assertEq(budget, 5 ether);
        assertEq(dl, deadline);
        assertEq(settled, false);
        assertEq(count, 0);
        assertEq(address(esc).balance, 5 ether);
    }

    function test_OpenRejectsPastDeadline() public {
        vm.warp(block.timestamp + 2 days);
        vm.prank(buyer);
        vm.expectRevert("deadline in past");
        esc.openJob{value: 1 ether}(JOB, deadline);
    }

    function test_SettlePass_CreditsWinner_RefundsRemainder_ReturnsBonds() public {
        _open(5 ether);
        _bond(pixel, 1 ether);
        _bond(cheap, 1 ether);

        vm.prank(buyer);
        esc.settle(JOB, pixel, 4 ether, true, 9);

        // pull payments: credits first…
        assertEq(esc.withdrawable(pixel), 5 ether); // 4 price + 1 bond
        assertEq(esc.withdrawable(cheap), 1 ether); // bond back
        assertEq(esc.withdrawable(buyer), 1 ether); // unspent budget

        // …then withdrawals drain the contract
        uint256 pixelBefore = pixel.balance;
        _withdraw(pixel);
        _withdraw(cheap);
        _withdraw(buyer);
        assertEq(pixel.balance, pixelBefore + 5 ether);
        assertEq(address(esc).balance, 0);

        (uint256 won, uint256 passed, uint256 scoreSum) = esc.reputation(pixel);
        assertEq(won, 1);
        assertEq(passed, 1);
        assertEq(scoreSum, 9);
    }

    function test_SettleFail_SlashGoesToTreasury_NotBuyer() public {
        _open(5 ether);
        _bond(pixel, 1 ether); // winner who delivers bad work
        _bond(cheap, 1 ether);

        vm.prank(buyer);
        esc.settle(JOB, pixel, 4 ether, false, 2);

        // buyer gets ONLY the budget back — no profit from rejecting
        assertEq(esc.withdrawable(buyer), 5 ether);
        // slashed bond goes to the treasury
        assertEq(esc.withdrawable(treasury), 1 ether);
        // winner gets nothing back; the other seller is made whole
        assertEq(esc.withdrawable(pixel), 0);
        assertEq(esc.withdrawable(cheap), 1 ether);

        (uint256 won, uint256 passed,) = esc.reputation(pixel);
        assertEq(won, 1);
        assertEq(passed, 0);
    }

    function test_MaliciousBonderCannotBrickSettlement() public {
        RevertingBonder evil = new RevertingBonder();
        vm.deal(address(this), 1 ether);

        _open(5 ether);
        _bond(pixel, 1 ether);
        evil.bond{value: 1 ether}(esc, JOB);

        // V1 would revert here (push-payment loop hits evil's receive()).
        // V2 settles fine — evil's refund just sits in withdrawable.
        vm.prank(buyer);
        esc.settle(JOB, pixel, 4 ether, true, 9);

        assertEq(esc.withdrawable(address(evil)), 1 ether);
        _withdraw(pixel); // everyone else is unaffected
        assertEq(esc.withdrawable(pixel), 0);
    }

    function test_ReclaimBondAfterDeadline() public {
        _open(5 ether);
        _bond(pixel, 1 ether);

        vm.warp(deadline + 1);
        vm.prank(pixel);
        esc.reclaimBond(JOB);

        assertEq(esc.withdrawable(pixel), 1 ether);
        assertEq(esc.bondOf(JOB, pixel), 0);
    }

    function test_CannotReclaimBeforeDeadline() public {
        _open(5 ether);
        _bond(pixel, 1 ether);
        vm.prank(pixel);
        vm.expectRevert("before deadline");
        esc.reclaimBond(JOB);
    }

    function test_CancelAfterDeadline_RefundsEveryone() public {
        _open(5 ether);
        _bond(pixel, 1 ether);
        _bond(cheap, 1 ether);

        vm.warp(deadline + 1);
        vm.prank(buyer);
        esc.cancelJob(JOB);

        assertEq(esc.withdrawable(buyer), 5 ether);
        assertEq(esc.withdrawable(pixel), 1 ether);
        assertEq(esc.withdrawable(cheap), 1 ether);

        // cancelled ≠ settled-with-verdict: no reputation written
        (uint256 won,,) = esc.reputation(pixel);
        assertEq(won, 0);

        // and the job cannot be settled afterwards
        vm.prank(buyer);
        vm.expectRevert("settled");
        esc.settle(JOB, pixel, 4 ether, true, 9);
    }

    function test_CannotCancelBeforeDeadline() public {
        _open(5 ether);
        vm.prank(buyer);
        vm.expectRevert("before deadline");
        esc.cancelJob(JOB);
    }

    function test_OnlyBuyerCanSettle() public {
        _open(5 ether);
        _bond(pixel, 1 ether);
        vm.prank(pixel);
        vm.expectRevert("only buyer");
        esc.settle(JOB, pixel, 4 ether, true, 9);
    }

    function test_NoDoubleSettle() public {
        _open(5 ether);
        _bond(pixel, 1 ether);
        vm.prank(buyer);
        esc.settle(JOB, pixel, 4 ether, true, 9);
        vm.prank(buyer);
        vm.expectRevert("settled");
        esc.settle(JOB, pixel, 4 ether, true, 9);
    }

    function test_CannotPayOverBudget() public {
        _open(5 ether);
        _bond(pixel, 1 ether);
        vm.prank(buyer);
        vm.expectRevert("over budget");
        esc.settle(JOB, pixel, 6 ether, true, 9);
    }

    function test_WinnerMustBeBonded() public {
        _open(5 ether);
        _bond(pixel, 1 ether);
        vm.prank(buyer);
        vm.expectRevert("winner not bonded");
        esc.settle(JOB, cheap, 4 ether, true, 9);
    }

    function test_CannotBondAfterDeadline() public {
        _open(5 ether);
        vm.warp(deadline + 1);
        vm.prank(pixel);
        vm.expectRevert("past deadline");
        esc.postBond{value: 1 ether}(JOB);
    }

    function test_WithdrawNothingReverts() public {
        vm.prank(pixel);
        vm.expectRevert("nothing to withdraw");
        esc.withdraw();
    }
}
