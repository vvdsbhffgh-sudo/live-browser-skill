// Windows (Microsoft UFO) and iPhone (iphone-control) — status helpers only.
//
// These are SEPARATE open-source projects. This repo does NOT vendor, copy,
// or re-implement any of their code. It only reports whether their MCP /
// control endpoints have been configured (via UFO_MCP_URL /
// IPHONE_CONTROL_URL) and, when configured, whether the endpoint answers.
//
// See docs/PLATFORMS.md for the full requirements and honest limits:
//  - Windows: Microsoft UFO / UFO² (microsoft/UFO, MIT, Python) — a
//    Windows AgentOS that drives real Windows apps via UI Automation,
//    Win32 and COM. It runs as the logged-in user with NO sandbox, so it
//    needs a dedicated low-privilege Windows account and human
//    confirmation before sensitive actions.
//  - iPhone: iOS is a closed system. There is no third-party agent that
//    drives an iPhone screen the way Artemis drives Android, and iOS is
//    only on Artemis's roadmap. The documented route is the open
//    iphone-control tool (WebDriverAgent / XCUITest): a real iPhone over
//    USB to a Mac or Linux machine, iOS 17+, Developer Mode, trust in the
//    computer and the certificate, free Apple ID signing renewed every 7
//    days, and the lock passcode entered manually after a reboot.

/**
 * Status for one optional device endpoint.
 *
 * @param {string} label e.g. "Windows (UFO)" / "iPhone (iphone-control)"
 * @param {string} envVar e.g. "UFO_MCP_URL"
 * @param {string} setupHint short pointer to docs/PLATFORMS.md
 * @param {NodeJS.ProcessEnv} [env=process.env]
 */
export function deviceStatus(label, envVar, setupHint, env = process.env) {
  const url = String(env[envVar] || "").trim() || null;
  if (!url) {
    return {
      configured: false,
      status: "not-configured",
      url: null,
      message:
        `${label} control is not configured. Set ${envVar} to the URL of your own ${label} server to enable status checks. ` +
        `Without it, this skill cannot touch any ${label === "Windows (UFO)" ? "Windows desktop" : "iPhone"}. ${setupHint}`,
    };
  }
  return {
    configured: true,
    status: "configured",
    url,
    message:
      `${label} endpoint is set. Use the matching status tool to check whether it answers. ` +
      `The ${label} project itself runs separately — this skill only talks to its endpoint.`,
  };
}

/** Windows / UFO status (env UFO_MCP_URL). */
export function windowsStatus(env = process.env) {
  return deviceStatus(
    "Windows (UFO)",
    "UFO_MCP_URL",
    "See docs/PLATFORMS.md — dedicated low-privilege Windows account required.",
    env,
  );
}

/** iPhone / iphone-control status (env IPHONE_CONTROL_URL). */
export function iphoneStatus(env = process.env) {
  return deviceStatus(
    "iPhone (iphone-control)",
    "IPHONE_CONTROL_URL",
    "See docs/PLATFORMS.md — iOS is closed; this is harder than Android and never as easy.",
    env,
  );
}
