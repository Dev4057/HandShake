// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HandshakeEscrowV2 — the money layer, with the V1 trust gaps closed.
/// @notice Everything HandshakeEscrow guarantees, plus:
///
///   7. Deadline — funds can never be locked forever. After `deadline`,
///      sellers reclaim their bonds and the buyer can cancel for a refund.
///   8. Pull payments — settle() CREDITS balances; recipients withdraw().
///      A malicious bonder that reverts on receive can no longer brick
///      settlement for everyone (the V1 push-loop griefing vector).
///   9. No profit from rejection — a slashed bond goes to `treasury`,
///      not the buyer, so the buyer gains nothing by falsely failing work.
///
/// NOT yet deployed — run `forge test` (WSL/Linux/macOS), then
/// `script/deploy-escrow.sh` against this contract when ready to migrate.
contract HandshakeEscrowV2 {
    struct Job {
        address buyer;
        uint256 budget;
        uint64 deadline; // unix seconds; after this, reclaim/cancel unlock
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

    /// @notice Pull-payment ledger: every payout lands here; owners withdraw().
    mapping(address => uint256) public withdrawable;

    /// @notice Where slashed bonds go — never the buyer (guardrail 9).
    address public immutable treasury;

    uint256 private _lock = 1;
    modifier nonReentrant() {
        require(_lock == 1, "reentrant");
        _lock = 2;
        _;
        _lock = 1;
    }

    event JobOpened(bytes32 indexed jobId, address indexed buyer, uint256 budget, uint64 deadline);
    event BondPosted(bytes32 indexed jobId, address indexed seller, uint256 amount);
    event Settled(bytes32 indexed jobId, address indexed winner, bool pass, uint256 paid);
    event JobCancelled(bytes32 indexed jobId);
    event BondReclaimed(bytes32 indexed jobId, address indexed seller, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event ReputationUpdated(address indexed seller, uint256 jobsWon, uint256 jobsPassed, uint256 scoreSum);

    constructor(address _treasury) {
        require(_treasury != address(0), "treasury required");
        treasury = _treasury;
    }

    /// @notice Buyer opens a job, locks the budget, and commits to a deadline.
    function openJob(bytes32 jobId, uint64 deadline) external payable {
        require(msg.value > 0, "budget required");
        require(deadline > block.timestamp, "deadline in past");
        Job storage j = jobs[jobId];
        require(!j.exists, "job exists");
        j.buyer = msg.sender;
        j.budget = msg.value;
        j.deadline = deadline;
        j.exists = true;
        emit JobOpened(jobId, msg.sender, msg.value, deadline);
    }

    /// @notice Seller stakes a bond to be allowed to bid.
    function postBond(bytes32 jobId) external payable {
        require(msg.value > 0, "bond required");
        Job storage j = jobs[jobId];
        require(j.exists, "no job");
        require(!j.settled, "settled");
        require(block.timestamp < j.deadline, "past deadline");
        if (j.bonds[msg.sender] == 0) j.bonders.push(msg.sender);
        j.bonds[msg.sender] += msg.value;
        emit BondPosted(jobId, msg.sender, msg.value);
    }

    /// @notice Buyer settles after verifying the delivered work.
    ///         pass -> credit winner (winnerPrice), refund remainder, return all bonds, reputation++
    ///         fail -> refund buyer the budget, slash winner's bond TO TREASURY, return other bonds
    /// @dev All payouts are credits; recipients call withdraw().
    function settle(bytes32 jobId, address winner, uint256 winnerPrice, bool pass, uint8 score)
        external
        nonReentrant
    {
        Job storage j = jobs[jobId];
        require(j.exists, "no job");
        require(msg.sender == j.buyer, "only buyer");
        require(!j.settled, "settled");
        require(j.bonds[winner] > 0, "winner not bonded");
        require(winnerPrice <= j.budget, "over budget");
        require(score <= 10, "bad score");

        j.settled = true; // effects before interactions

        Rep storage r = reputation[winner];
        r.jobsWon += 1;
        r.scoreSum += score;
        if (pass) r.jobsPassed += 1;
        emit ReputationUpdated(winner, r.jobsWon, r.jobsPassed, r.scoreSum);

        uint256 budget = j.budget;
        uint256 paid = 0;

        if (pass) {
            paid = winnerPrice;
            _credit(winner, winnerPrice);
            if (budget > winnerPrice) _credit(j.buyer, budget - winnerPrice);
            for (uint256 i = 0; i < j.bonders.length; i++) {
                address b = j.bonders[i];
                uint256 amt = j.bonds[b];
                j.bonds[b] = 0;
                _credit(b, amt);
            }
        } else {
            _credit(j.buyer, budget);
            for (uint256 i = 0; i < j.bonders.length; i++) {
                address b = j.bonders[i];
                uint256 amt = j.bonds[b];
                j.bonds[b] = 0;
                // slashed bond goes to the treasury — the buyer cannot profit
                // from rejecting good work
                if (b == winner) _credit(treasury, amt);
                else _credit(b, amt);
            }
        }

        emit Settled(jobId, winner, pass, paid);
    }

    /// @notice After the deadline on an unsettled job, a seller takes its bond back.
    function reclaimBond(bytes32 jobId) external {
        Job storage j = jobs[jobId];
        require(j.exists, "no job");
        require(!j.settled, "settled");
        require(block.timestamp >= j.deadline, "before deadline");
        uint256 amt = j.bonds[msg.sender];
        require(amt > 0, "no bond");
        j.bonds[msg.sender] = 0;
        _credit(msg.sender, amt);
        emit BondReclaimed(jobId, msg.sender, amt);
    }

    /// @notice After the deadline on an unsettled job, the buyer cancels:
    ///         budget refunded, every remaining bond returned to its owner.
    ///         No reputation is written — an expired market is nobody's failure.
    function cancelJob(bytes32 jobId) external {
        Job storage j = jobs[jobId];
        require(j.exists, "no job");
        require(msg.sender == j.buyer, "only buyer");
        require(!j.settled, "settled");
        require(block.timestamp >= j.deadline, "before deadline");

        j.settled = true;
        _credit(j.buyer, j.budget);
        for (uint256 i = 0; i < j.bonders.length; i++) {
            address b = j.bonders[i];
            uint256 amt = j.bonds[b];
            j.bonds[b] = 0;
            _credit(b, amt);
        }
        emit JobCancelled(jobId);
    }

    /// @notice Pull your accumulated payouts.
    function withdraw() external nonReentrant {
        uint256 amt = withdrawable[msg.sender];
        require(amt > 0, "nothing to withdraw");
        withdrawable[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: amt}("");
        require(ok, "transfer failed");
        emit Withdrawn(msg.sender, amt);
    }

    // ---- views ----

    function getJob(bytes32 jobId)
        external
        view
        returns (address buyer, uint256 budget, uint64 deadline, bool exists, bool settled, uint256 bonderCount)
    {
        Job storage j = jobs[jobId];
        return (j.buyer, j.budget, j.deadline, j.exists, j.settled, j.bonders.length);
    }

    function bondOf(bytes32 jobId, address seller) external view returns (uint256) {
        return jobs[jobId].bonds[seller];
    }

    // ---- internal ----

    function _credit(address to, uint256 amt) private {
        if (amt == 0) return;
        withdrawable[to] += amt;
    }
}
