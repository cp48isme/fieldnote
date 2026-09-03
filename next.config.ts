import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Stop `next dev` writing to CLAUDE.md.
   *
   * Next 16 appends a `nextjs-agent-rules` block to CLAUDE.md on every dev run and
   * re-adds it if removed. Nothing about the text is hostile, but CLAUDE.md is where this
   * project's non-negotiable constraints live, and a build tool editing it on every run is
   * a write into the governance layer rather than a formatting nuisance. The block it
   * writes also contains instructions addressed to the agent, including advice to commit
   * the change — which is exactly the thing not to do because a tool said so.
   *
   * Third instance of the same class: `fieldnote-rrv` (an installer rewrote instructions
   * here), `fieldnote-vmj` (an installer repointed `core.hooksPath` and silently disabled
   * the pre-commit gate), and this. See `fieldnote-n8z`.
   */
  agentRules: false,
};

export default nextConfig;
