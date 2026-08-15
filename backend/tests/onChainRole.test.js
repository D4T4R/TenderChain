const { ethers } = require('ethers');
const { requireOnChainRole } = require('../middleware/authMiddleware');
const chain = require('../services/chainService');

jest.mock('../services/chainService', () => ({
  hasRole: jest.fn(),
  roleId: jest.requireActual('../services/chainService').roleId,
}));

function mockReqRes(auth) {
  return [{ auth, method: 'POST', originalUrl: '/api/x' }, {}];
}

describe('requireOnChainRole', () => {
  afterEach(() => jest.clearAllMocks());

  it('rejects when unauthenticated', async () => {
    const [req, res] = mockReqRes(undefined);
    const next = jest.fn();

    await requireOnChainRole('ContractorRepo', 'VERIFIER_ROLE')(req, res, next);

    expect(next.mock.calls[0][0].statusCode).toBe(401);
    expect(chain.hasRole).not.toHaveBeenCalled();
  });

  it('passes when the wallet holds the role on chain', async () => {
    chain.hasRole.mockResolvedValue(true);
    const [req, res] = mockReqRes({ walletAddress: '0x' + '1'.repeat(40) });
    const next = jest.fn();

    await requireOnChainRole('ContractorRepo', 'VERIFIER_ROLE')(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(chain.hasRole).toHaveBeenCalledWith(
      'ContractorRepo',
      'VERIFIER_ROLE',
      '0x' + '1'.repeat(40)
    );
  });

  it('rejects with 403 when the chain says no, even if the DB role says yes', async () => {
    chain.hasRole.mockResolvedValue(false);
    // Application role claims verifier; the registry disagrees.
    const [req, res] = mockReqRes({
      walletAddress: '0x' + '2'.repeat(40),
      role: 'verifier',
    });
    const next = jest.fn();

    await requireOnChainRole('ContractorRepo', 'VERIFIER_ROLE')(req, res, next);

    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  it('fails closed with 503 when the chain is unreachable', async () => {
    // Must not fail open: if authority cannot be proven, refuse.
    chain.hasRole.mockRejectedValue(new Error('ECONNREFUSED'));
    const [req, res] = mockReqRes({ walletAddress: '0x' + '3'.repeat(40) });
    const next = jest.fn();

    await requireOnChainRole('ContractorRepo', 'VERIFIER_ROLE')(req, res, next);

    expect(next.mock.calls[0][0].statusCode).toBe(503);
  });
});

describe('chainService.roleId', () => {
  const { roleId } = jest.requireActual('../services/chainService');

  it('matches OpenZeppelin: keccak256 of the role name', () => {
    expect(roleId('VERIFIER_ROLE')).toBe(ethers.id('VERIFIER_ROLE'));
    expect(roleId('REGISTRAR_ROLE')).toBe(ethers.id('REGISTRAR_ROLE'));
  });

  it('maps DEFAULT_ADMIN_ROLE to zero', () => {
    expect(roleId('DEFAULT_ADMIN_ROLE')).toBe(ethers.ZeroHash);
  });
});
