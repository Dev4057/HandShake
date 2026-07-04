// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HandshakeEscrow} from "../contracts/HandshakeEscrow.sol";

contract HandshakeEscrowTest is Test {
    HandshakeEscrow esc;
    address buyer = makeAddr("buyer");
    address pixel = makeAddr("PixelPro");
    address cheap = makeAddr("CheapBot");
    bytes32 constant JOB = keccak256("job-1");

    function setUp() public {
        esc = new HandshakeEscrow();
        vm.deal(buyer, 100 ether);
        vm.deal(pixel, 10 ether);
        vm.deal(cheap, 10 ether);
    }

    function _open(uint256 budget) internal {
        vm.prank(buyer);
        esc.openJob{value: budget}(JOB);
    }

    function _bond(address who, uint256 amt) internal {
        vm.prank(who);
        esc.postBond{value: amt}(JOB);
    }

    function test_OpenLocksBudget() public {
        _open(5 ether);
        (address b, uint256 budget,, bool settled, uint256 count) = esc.getJob(JOB);
        assertEq(b, buyer);
        assertEq(budget, 5 ether);
        assertEq(settled, false);
        assertEq(count, 0);
        assertEq(address(esc).balance, 5 ether);
    }

    function test_PostBond() public {
        _open(5 ether);
        _bond(pixel, 1 ether);
        _bond(cheap, 1 ether);
        assertEq(esc.bondOf(JOB, pixel), 1 ether);
        (,,,, uint256 count) = esc.getJob(JOB);
        assertEq(count, 2);
        assertEq(address(esc).balance, 7 ether); // 5 budget + 2 bonds
    }

    function test_SettlePass_PaysWinner_RefundsRemainder_ReturnsBonds() public {
        _open(5 ether);
        _bond(pixel, 1 ether);
        _bond(cheap, 1 ether);

        uint256 buyerBefore = buyer.balance;
        uint256 pixelBefore = pixel.balance;
        uint256 cheapBefore = cheap.balance;

        // winner PixelPro at a negotiated price of 4 ether, PASS, score 9
        vm.prank(buyer);
        esc.settle(JOB, pixel, 4 ether, true, 9);

        // winner: +4 price +1 bond back
        assertEq(pixel.balance, pixelBefore + 5 ether);
        // loser: +1 bond back
        assertEq(cheap.balance, cheapBefore + 1 ether);
        // buyer: +1 ether unspent budget refunded (5 budget - 4 paid)
        assertEq(buyer.balance, buyerBefore + 1 ether);
        // contract drained
        assertEq(address(esc).balance, 0);

        (uint256 won, uint256 passed, uint256 scoreSum) = esc.reputation(pixel);
        assertEq(won, 1);
        assertEq(passed, 1);
        assertEq(scoreSum, 9);
    }

    function test_SettleFail_RefundsBuyer_SlashesWinnerBond() public {
        _open(5 ether);
        _bond(pixel, 1 ether); // winner who delivers bad work
        _bond(cheap, 1 ether);

        uint256 buyerBefore = buyer.balance;
        uint256 pixelBefore = pixel.balance;
        uint256 cheapBefore = cheap.balance;

        vm.prank(buyer);
        esc.settle(JOB, pixel, 4 ether, false, 2);

        // buyer: +5 budget refunded +1 slashed bond
        assertEq(buyer.balance, buyerBefore + 6 ether);
        // winner: bond slashed -> gets nothing back
        assertEq(pixel.balance, pixelBefore);
        // other seller: bond returned
        assertEq(cheap.balance, cheapBefore + 1 ether);
        assertEq(address(esc).balance, 0);

        (uint256 won, uint256 passed,) = esc.reputation(pixel);
        assertEq(won, 1);
        assertEq(passed, 0); // failed -> no success recorded
    }

    function test_OnlyBuyerCanSettle() public {
        _open(5 ether);
        _bond(pixel, 1 ether);
        vm.prank(pixel); // not the buyer
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
        esc.settle(JOB, pixel, 6 ether, true, 9); // price > budget
    }

    function test_WinnerMustBeBonded() public {
        _open(5 ether);
        _bond(pixel, 1 ether);
        vm.prank(buyer);
        vm.expectRevert("winner not bonded");
        esc.settle(JOB, cheap, 4 ether, true, 9); // cheap never bonded
    }
}
