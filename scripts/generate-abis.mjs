#!/usr/bin/env node
/**
 * Generates a single canonical ABI module for the frontend from the truffle
 * build artifacts.
 *
 * The repository previously carried two hand-maintained copies of the ABIs
 * (frontend/examples/abi.js and web3/abi.js) which had already diverged, so
 * callers could be talking to the contracts with a stale interface. Deriving
 * them from build/contracts at build time removes that class of bug.
 *
 * Usage: node scripts/generate-abis.mjs
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactsDir = join(root, "build", "contracts");
const outFile = join(root, "frontend-next", "src", "lib", "contracts", "abis.ts");

// Contracts the frontend actually talks to.
const WANTED = [
  "TenderRepo",
  "ContractRepo",
  "ContractorRepo",
  "GovernmentOfficerRepo",
  "FactoryTender",
  "FactoryContract",
  "FactoryContractor",
  "FactoryGovernmentOfficer",
  "FactoryVerifier",
  "Tender",
  "Contract",
  "Contractor",
  "GovernmentOfficer",
  "Verifier",
  "StakeManager",
  "PublicClaims",
  "PublicDashboard",
];

const files = await readdir(artifactsDir).catch(() => {
  console.error(
    `No artifacts at ${artifactsDir}.\nRun "npx truffle compile" first.`
  );
  process.exit(1);
});

const entries = [];
const missing = [];

for (const name of WANTED) {
  const file = `${name}.json`;
  if (!files.includes(file)) {
    missing.push(name);
    continue;
  }
  const artifact = JSON.parse(await readFile(join(artifactsDir, file), "utf8"));
  entries.push({ name, abi: artifact.abi });
}

if (missing.length) {
  console.warn(`Warning: no artifact for ${missing.join(", ")}`);
}

const body = entries
  .map(({ name, abi }) => `export const ${name}ABI = ${JSON.stringify(abi, null, 2)} as const;`)
  .join("\n\n");

const contents = `// GENERATED FILE - DO NOT EDIT.
// Produced by scripts/generate-abis.mjs from build/contracts.
// Regenerate with: npm run generate:abis

${body}

export const ABIS = {
${entries.map(({ name }) => `  ${name}: ${name}ABI,`).join("\n")}
} as const;

export type ContractName = keyof typeof ABIS;
`;

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, contents);

console.log(`Wrote ${entries.length} ABIs to ${outFile}`);
