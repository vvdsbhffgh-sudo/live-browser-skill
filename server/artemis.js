// Google Artemis (google/artemis) — status helper only.
//
// Artemis is a SEPARATE project by Google (Apache 2.0): an open-source AI
// agent that drives a real Android phone / emulator over MCP. This repo does
// NOT vendor, copy, or re-implement any Artemis code. It only reports
// whether an Artemis MCP server has been configured (via ARTEMIS_MCP_URL)
// and, when configured, whether that endpoint answers.
//
// See docs/ARTEMIS.md for the full requirements and honest limits:
// Python 3.12+, a real Android device with USB Debugging or an emulator, a
// DEDICATED test device (never the user's personal phone/accounts), and a
// separate model API key paid by the user to their provider.

/**
 * Synchronous status: configured or not. No network is touched here, so
 * this is safe to call from tests and from browser_status.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {{configured: boolean, status: string, mcpUrl: string|null, message: string}}
 */
export function artemisStatus(env = process.env) {
  const mcpUrl = String(env.ARTEMIS_MCP_URL || "").trim() || null;
  if (!mcpUrl) {
    return {
      configured: false,
      status: "not-configured",
      mcpUrl: null,
      message:
        "Artemis phone control is not configured. Set ARTEMIS_MCP_URL to the URL of your own Artemis MCP server (see docs/ARTEMIS.md) to enable phone_status checks. Without it, this skill controls the desktop browser only — it cannot touch any phone.",
    };
  }
  return {
    configured: true,
    status: "configured",
    mcpUrl,
    message:
      "Artemis MCP URL is set. Use the phone_status tool to check whether the Artemis server answers. Artemis itself runs separately (Python 3.12+, Android device/emulator, your own paid model key) — this skill only talks to its MCP endpoint.",
  };
}

/**
 * Live reachability check against a configured Artemis MCP endpoint.
 * Best-effort only: a short timeout, no credentials sent, any failure is
 * reported as unreachable rather than thrown.
 *
 * @param {string} mcpUrl
 * @param {number} [timeoutMs=3000]
 * @returns {Promise<{reachable: boolean, status: number|null, message: string}>}
 */
export async function checkArtemisReachable(mcpUrl, timeoutMs = 3000) {
  try {
    const res = await fetch(mcpUrl, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "manual",
    });
    return {
      reachable: true,
      status: res.status,
      message: `Artemis MCP endpoint answered with HTTP ${res.status}.`,
    };
  } catch (err) {
    return {
      reachable: false,
      status: null,
      message: `Artemis MCP endpoint did not answer (${String(err?.message ?? err).slice(0, 200)}). Is the Artemis server running? See docs/ARTEMIS.md.`,
    };
  }
}
