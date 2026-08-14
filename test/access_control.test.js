const TenderRepo = artifacts.require("TenderRepo");
const ContractRepo = artifacts.require("ContractRepo");
const ContractorRepo = artifacts.require("ContractorRepo");
const GovernmentOfficerRepo = artifacts.require("GovernmentOfficerRepo");
const StakeManager = artifacts.require("StakeManager");

/**
 * Asserts the "who may call what" matrix introduced by TenderRoles.
 *
 * Every registry mutator and the stake slashing path used to be callable by any
 * address. These tests pin that down so a future refactor cannot silently
 * reopen them.
 */
async function expectRevert(promise, description) {
  try {
    await promise;
  } catch (err) {
    assert(
      /revert|AccessControl/i.test(err.message),
      `${description}: expected an access control revert, got: ${err.message}`
    );
    return;
  }
  assert.fail(`${description}: expected revert, but the call succeeded`);
}

contract("Access control", (accounts) => {
  const [admin, outsider, someNode, someWallet] = accounts;

  describe("TenderRepo", () => {
    let repo;
    beforeEach(async () => {
      repo = await TenderRepo.new(admin);
      await repo.grantRole(await repo.REGISTRAR_ROLE(), admin);
      await repo.grantRole(await repo.STATUS_UPDATER_ROLE(), admin);
    });

    it("rejects newTender from an address without REGISTRAR_ROLE", async () => {
      await expectRevert(
        repo.newTender(someNode, { from: outsider }),
        "unauthorised newTender"
      );
    });

    it("allows newTender from a REGISTRAR", async () => {
      await repo.newTender(someNode, { from: admin });
      assert.equal(await repo.getTenderCount(), 1);
      assert.equal(await repo.isRegisteredTender(someNode), true);
    });

    it("rejects duplicate registration", async () => {
      await repo.newTender(someNode, { from: admin });
      await expectRevert(
        repo.newTender(someNode, { from: admin }),
        "duplicate tender"
      );
    });

    it("rejects status updates from an address without STATUS_UPDATER_ROLE", async () => {
      await repo.newTender(someNode, { from: admin });
      await expectRevert(
        repo.updateTenderStatusToBiddingComplete(someNode, { from: outsider }),
        "unauthorised bidding-complete"
      );
      await expectRevert(
        repo.updateTenderStatusToDeployed(someNode, { from: outsider }),
        "unauthorised deployed"
      );
    });

    it("allows status updates from a STATUS_UPDATER", async () => {
      await repo.newTender(someNode, { from: admin });
      await repo.updateTenderStatusToBiddingComplete(someNode, { from: admin });
      assert.equal((await repo.getTenderStatus(someNode)).toString(), "1");
    });

    it("rejects status updates for an unregistered tender", async () => {
      await expectRevert(
        repo.updateTenderStatusToBiddingComplete(outsider, { from: admin }),
        "unknown tender"
      );
    });
  });

  describe("ContractRepo", () => {
    let repo;
    beforeEach(async () => {
      repo = await ContractRepo.new(admin);
      await repo.grantRole(await repo.REGISTRAR_ROLE(), admin);
      await repo.grantRole(await repo.STATUS_UPDATER_ROLE(), admin);
    });

    it("rejects addToContracts from an outsider", async () => {
      await expectRevert(
        repo.addToContracts(someNode, { from: outsider }),
        "unauthorised addToContracts"
      );
    });

    it("rejects updateContractStatusToComplete from an outsider", async () => {
      await repo.addToContracts(someNode, { from: admin });
      await expectRevert(
        repo.updateContractStatusToComplete(someNode, { from: outsider }),
        "unauthorised complete"
      );
    });

    it("does not double-count a contract completed twice", async () => {
      await repo.addToContracts(someNode, { from: admin });
      await repo.updateContractStatusToComplete(someNode, { from: admin });
      await expectRevert(
        repo.updateContractStatusToComplete(someNode, { from: admin }),
        "already complete"
      );
      const completed = await repo.getCompletedContracts();
      assert.equal(completed.length, 1);
    });
  });

  describe("ContractorRepo", () => {
    let repo;
    beforeEach(async () => {
      repo = await ContractorRepo.new(admin);
      await repo.grantRole(await repo.REGISTRAR_ROLE(), admin);
      await repo.grantRole(await repo.VERIFIER_ROLE(), admin);
    });

    it("rejects newContractor from an outsider", async () => {
      await expectRevert(
        repo.newContractor(someWallet, someNode, { from: outsider }),
        "unauthorised newContractor"
      );
    });

    it("rejects verifyContractor from a non-verifier", async () => {
      await repo.newContractor(someWallet, someNode, { from: admin });
      await expectRevert(
        repo.verifyContractor(someNode, { from: outsider }),
        "unauthorised verifyContractor"
      );
    });

    it("records msg.sender as the verifier, not a caller-supplied address", async () => {
      await repo.newContractor(someWallet, someNode, { from: admin });
      await repo.verifyContractor(someNode, { from: admin });
      assert.equal(await repo.getVerifier(someNode), admin);
      assert.equal(await repo.getVerificationStatus(someNode), true);
    });

    it("does not expose a public wallet-to-node remapping function", () => {
      assert.strictEqual(
        typeof repo.mapWalletAddressToNode,
        "undefined",
        "mapWalletAddressToNode must not be externally callable - it allowed identity hijacking"
      );
    });
  });

  describe("GovernmentOfficerRepo", () => {
    let repo;
    beforeEach(async () => {
      repo = await GovernmentOfficerRepo.new(admin);
      await repo.grantRole(await repo.REGISTRAR_ROLE(), admin);
      await repo.grantRole(await repo.VERIFIER_ROLE(), admin);
    });

    it("rejects newOfficer from an outsider", async () => {
      await expectRevert(
        repo.newOfficer(someWallet, someNode, { from: outsider }),
        "unauthorised newOfficer"
      );
    });

    it("rejects verifyOfficer from a non-verifier", async () => {
      await repo.newOfficer(someWallet, someNode, { from: admin });
      await expectRevert(
        repo.verifyOfficer(someNode, { from: outsider }),
        "unauthorised verifyOfficer"
      );
    });

    it("does not expose a public wallet-to-node remapping function", () => {
      assert.strictEqual(typeof repo.mapWalletAddressToNode, "undefined");
    });
  });

  describe("StakeManager", () => {
    let sm;
    const VOTE_ON_CLAIM = 3;
    const voteStake = web3.utils.toWei("0.05", "ether");

    beforeEach(async () => {
      sm = await StakeManager.new(admin);
    });

    it("rejects slashStake from an address without SLASHER_ROLE", async () => {
      await sm.createStake(VOTE_ON_CLAIM, someNode, {
        from: outsider,
        value: voteStake,
      });
      await expectRevert(
        sm.slashStake(0, "malicious", { from: outsider }),
        "unauthorised slash"
      );
    });

    it("rejects slashStake even from the admin unless granted SLASHER_ROLE", async () => {
      await sm.createStake(VOTE_ON_CLAIM, someNode, {
        from: outsider,
        value: voteStake,
      });
      await expectRevert(
        sm.slashStake(0, "admin overreach", { from: admin }),
        "admin slash without role"
      );
    });

    it("allows slashing once SLASHER_ROLE is granted, and pools the funds", async () => {
      await sm.createStake(VOTE_ON_CLAIM, someNode, {
        from: outsider,
        value: voteStake,
      });
      await sm.grantRole(await sm.SLASHER_ROLE(), admin);
      await sm.slashStake(0, "incorrect vote", { from: admin });

      assert.equal(
        (await sm.slashedPool()).toString(),
        voteStake,
        "slashed value must be accounted for, not stranded"
      );
    });

    it("reflects slashing in getStakesByAddress", async () => {
      await sm.createStake(VOTE_ON_CLAIM, someNode, {
        from: outsider,
        value: voteStake,
      });
      await sm.grantRole(await sm.SLASHER_ROLE(), admin);
      await sm.slashStake(0, "incorrect vote", { from: admin });

      const stakes = await sm.getStakesByAddress(outsider);
      assert.equal(stakes.length, 1);
      assert.equal(stakes[0].isSlashed, true, "per-address view must not report a stale copy");
      assert.equal(stakes[0].isActive, false);
    });

    it("lets the admin withdraw slashed funds, and nobody else", async () => {
      await sm.createStake(VOTE_ON_CLAIM, someNode, {
        from: outsider,
        value: voteStake,
      });
      await sm.grantRole(await sm.SLASHER_ROLE(), admin);
      await sm.slashStake(0, "incorrect vote", { from: admin });

      await expectRevert(
        sm.withdrawSlashedFunds(outsider, voteStake, { from: outsider }),
        "unauthorised withdrawal"
      );

      await sm.withdrawSlashedFunds(admin, voteStake, { from: admin });
      assert.equal((await sm.slashedPool()).toString(), "0");
    });

    it("prevents a staker from releasing somebody else's stake", async () => {
      await sm.createStake(VOTE_ON_CLAIM, someNode, {
        from: outsider,
        value: voteStake,
      });
      await expectRevert(
        sm.releaseStake(0, { from: admin }),
        "release by non-owner"
      );
    });

    it("returns the stake to its owner on release", async () => {
      await sm.createStake(VOTE_ON_CLAIM, someNode, {
        from: outsider,
        value: voteStake,
      });
      await sm.releaseStake(0, { from: outsider });

      const stakes = await sm.getStakesByAddress(outsider);
      assert.equal(stakes[0].isActive, false);
      assert.equal((await sm.totalStakedByAddress(outsider)).toString(), "0");
    });
  });
});
