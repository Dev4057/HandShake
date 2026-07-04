// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HandshakeEscrow — the money layer for the Handshake agent market.
/// @notice Buyer locks a budget, sellers stake bonds, and funds release ONLY on a
///         verified verdict. The contract constrains every outcome, so an autonomous
///         agent can only pull allowed levers — never invent a transfer.
///
/// Guardrails baked in:
///   1. Escrow, not direct transfer — money only exits via settle().
///   2. Budget cap — winner is paid at most the pre-locked budget.
///   3. Conditional release — gated by the pass/fail verdict.
///   4. Access control — only the job's buyer can settle it.
///   5. No double-settle — a job settles exactly once.
///   6. Bonds — sellers stake skin in the game; a losing winner is slashed.
///   + Reentrancy guard on the one fund-moving function.
contract HandshakeEscrow {
    struct Job {
        address buyer;
        uint256 budget;
        bool exists;
        bool settled;
        address[] bonders;
        mapping(address => uint256) bonds;
    }

    struct Rep {
        uint256 jobsWon;    // jobs this seller won
        uint256 jobsPassed; // of those, how many passed verification
        uint256 scoreSum;   // sum of per-job scores (0-10); average = scoreSum / jobsWon
    }

    mapping(bytes32 => Job) private jobs;
    mapping(address => Rep) public reputation;

    uint256 private _lock = 1;
    modifier nonReentrant() {
        require(_lock == 1, "reentrant");
        _lock = 2;
        _;
        _lock = 1;
    }

    event JobOpened(bytes32 indexed jobId, address indexed buyer, uint256 budget);
    event BondPosted(bytes32 indexed jobId, address indexed seller, uint256 amount);
    event Settled(bytes32 indexed jobId, address indexed winner, bool pass, uint256 paid);
    event ReputationUpdated(address indexed seller, uint256 jobsWon, uint256 jobsPassed, uint256 scoreSum);

    /// @notice Buyer opens a job and locks the budget in escrow (guardrail 1 & 2).
    function openJob(bytes32 jobId) external payable {
        require(msg.value > 0, "budget required");
        Job storage j = jobs[jobId];
        require(!j.exists, "job exists");
        j.buyer = msg.sender;
        j.budget = msg.value;
        j.exists = true;
        emit JobOpened(jobId, msg.sender, msg.value);
    }

    /// @notice Seller stakes a bond to be allowed to bid (guardrail 6).
    function postBond(bytes32 jobId) external payable {
        require(msg.value > 0, "bond required");
        Job storage j = jobs[jobId];
        require(j.exists, "no job");
        require(!j.settled, "settled");
        if (j.bonds[msg.sender] == 0) j.bonders.push(msg.sender);
        j.bonds[msg.sender] += msg.value;
        emit BondPosted(jobId, msg.sender, msg.value);
    }

    /// @notice Buyer settles after verifying the delivered work.
    ///         pass  -> pay winner (winnerPrice), refund remainder, return all bonds, reputation++
    ///         fail  -> refund buyer the full budget, slash winner's bond to buyer, return other bonds, reputation--
    /// @param score 0-10 quality score from the buyer's verifier.
    function settle(bytes32 jobId, address winner, uint256 winnerPrice, bool pass, uint8 score)
        external
        nonReentrant
    {
        Job storage j = jobs[jobId];
        require(j.exists, "no job");
        require(msg.sender == j.buyer, "only buyer");        // guardrail 4
        require(!j.settled, "settled");                       // guardrail 5
        require(j.bonds[winner] > 0, "winner not bonded");
        require(winnerPrice <= j.budget, "over budget");      // guardrail 2
        require(score <= 10, "bad score");

        j.settled = true;                                     // effects before interactions

        // reputation
        Rep storage r = reputation[winner];
        r.jobsWon += 1;
        r.scoreSum += score;
        if (pass) r.jobsPassed += 1;
        emit ReputationUpdated(winner, r.jobsWon, r.jobsPassed, r.scoreSum);

        uint256 budget = j.budget;
        uint256 paid = 0;

        if (pass) {
            // pay the winner, refund any unspent budget to the buyer
            paid = winnerPrice;
            _send(winner, winnerPrice);
            if (budget > winnerPrice) _send(j.buyer, budget - winnerPrice);
            // return every bond
            for (uint256 i = 0; i < j.bonders.length; i++) {
                address b = j.bonders[i];
                uint256 amt = j.bonds[b];
                j.bonds[b] = 0;
                _send(b, amt);
            }
        } else {
            // refund the full budget to the buyer
            _send(j.buyer, budget);
            // slash the winner's bond (to the buyer), return everyone else's
            for (uint256 i = 0; i < j.bonders.length; i++) {
                address b = j.bonders[i];
                uint256 amt = j.bonds[b];
                j.bonds[b] = 0;
                if (b == winner) _send(j.buyer, amt);
                else _send(b, amt);
            }
        }

        emit Settled(jobId, winner, pass, paid);
    }

    // ---- views ----

    function getJob(bytes32 jobId)
        external
        view
        returns (address buyer, uint256 budget, bool exists, bool settled, uint256 bonderCount)
    {
        Job storage j = jobs[jobId];
        return (j.buyer, j.budget, j.exists, j.settled, j.bonders.length);
    }

    function bondOf(bytes32 jobId, address seller) external view returns (uint256) {
        return jobs[jobId].bonds[seller];
    }

    // ---- internal ----

    function _send(address to, uint256 amt) private {
        if (amt == 0) return;
        (bool ok, ) = payable(to).call{value: amt}("");
        require(ok, "transfer failed");
    }
}
