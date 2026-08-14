"use client";

import { useMemo } from "react";
import { Contract } from "ethers";
import { ABIS, type ContractName } from "@/lib/contracts/abis";
import { getAddress, type DeployedContract } from "@/lib/contracts/addresses";
import { useWallet } from "./WalletProvider";

/**
 * Returns an ethers Contract bound to the connected signer, or null when no
 * wallet is connected. Read-only calls fall back to the provider so public
 * pages work without a wallet.
 */
export function useContract(name: ContractName & DeployedContract): Contract | null {
  const { signer, provider } = useWallet();

  return useMemo(() => {
    const runner = signer ?? provider;
    if (!runner) return null;

    let address: string;
    try {
      address = getAddress(name);
    } catch {
      return null;
    }

    return new Contract(address, ABIS[name] as never, runner);
  }, [name, signer, provider]);
}
