import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next regenerates AGENTS.md/CLAUDE.md on every dev boot otherwise.
  agentRules: false,
  turbopack: {
    // The repo root also has a package-lock.json (truffle/solc tooling), so
    // Next would otherwise infer the wrong workspace root.
    root: path.join(__dirname),
  },
};

export default nextConfig;
