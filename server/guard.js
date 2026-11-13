// Payment guard for Atlas.
//
// HARD RULE: this skill never pays. Anything that looks like a checkout or
// payment flow is refused before the browser acts on it, and credit-card-like
// numbers are never typed or filled anywhere.
//
// This module has no dependencies and no side effects so it can be
// unit-tested in isolation (see test/payment-guard.test.js).

// URL fragments / hostnames that indicate a checkout or payment page.
export const PAYMENT_URL_PATTERNS = [
  "checkout",
  "/pay",
  "/payment",
  "/payments",
  "/billing",
  "stripe",
  "paypal",
  "checkout.stripe",
  "pay.stripe",
  "buy.stripe",
  "squareup.com",
  "checkout.",
  "/donate",
  "/subscribe",
  "/subscription",
  "apple-pay",
  "google-pay",
  "braintree",
  "adyen",
  "2checkout",
  "authorize.net",
];

// Words/phrases in page or element text that indicate a payment form/button.
export const PAYMENT_TEXT_PATTERNS = [
  "card number",
  "credit card number",
  "debit card",
  "cvv",
  "cvc",
  "card expiry",
  "expiration date",
  "expiry date",
  "pay now",
  "confirm payment",
  "complete payment",
  "complete purchase",
  "place order",
  "pay with card",
  "add payment method",
  "add a payment method",
  "add card",
  "billing address",
  "cardholder name",
  "name on card",
  "security code",
];

// A 13-19 digit run (allowing spaces / dashes between digits) is treated as
// a card-like number. This is intentionally broad: the skill must never type
// anything that could be a card number.
const CARD_NUMBER_RE = /(?:\d[ -]?){13,19}/;

function normalise(value) {
  return String(value ?? "").toLowerCase();
}

function matchesAny(haystack, patterns) {
  const text = normalise(haystack);
  return patterns.find((p) => text.includes(p)) ?? null;
}

/** True when the URL looks like a checkout / payment URL. */
export function isPaymentUrl(url) {
  if (!url) return false;
  return matchesAny(url, PAYMENT_URL_PATTERNS) !== null;
}

/** True when the text looks like payment-form copy or a pay button. */
export function containsPaymentText(text) {
  if (!text) return false;
  return matchesAny(text, PAYMENT_TEXT_PATTERNS) !== null;
}

/** True when the text contains a 13-19 digit card-like sequence. */
export function isCardNumber(text) {
  if (!text) return false;
  // Strip spaces/dashes and check for a contiguous digit run of 13-19.
  const digits = String(text).replace(/[^0-9]/g, "");
  if (digits.length >= 13 && digits.length <= 19 && /^\d+$/.test(digits)) {
    // Only flag it when the input is (mostly) the number itself, or when a
    // digit run of that length appears inside the text.
    return CARD_NUMBER_RE.test(String(text));
  }
  return CARD_NUMBER_RE.test(String(text)) && digits.length >= 13;
}

/** True when the URL uses an allowed scheme (http/https only). */
export function isAllowedUrl(url) {
  try {
    const parsed = new URL(String(url));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Wave 3: HTTPS-only. Plain http is allowed ONLY for localhost / 127.0.0.1
// (the local Live View and local dev servers). Every other http:// URL is
// refused: credentials and sessions must never travel unencrypted.
// TLS certificate verification is the browser's / fetch default — this
// project never sets rejectUnauthorized=false or any insecure TLS flag.
// ---------------------------------------------------------------------------

/** True when the URL's host is localhost / 127.0.0.1 / ::1. */
export function isLocalhostUrl(url) {
  try {
    const host = new URL(String(url)).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

/** True when the URL is https:// (or http:// to localhost only). */
export function isSecureUrl(url) {
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol === "https:") return true;
    if (parsed.protocol === "http:" && isLocalhostUrl(url)) return true;
    return false;
  } catch {
    return false;
  }
}

/** Check a URL against the HTTPS-only rule. Returns { ok } / { ok, reason }. */
export function checkSecureUrl(url) {
  if (!url || typeof url !== "string") {
    return { ok: false, reason: "Blocked: no URL given." };
  }
  if (!isAllowedUrl(url)) {
    return { ok: false, reason: `Blocked: only http:// and https:// URLs are allowed (got ${url}).` };
  }
  if (!isSecureUrl(url)) {
    return {
      ok: false,
      reason:
        `Blocked: HTTPS only. Plain http:// is allowed only for localhost (local dev / Live View). ` +
        `Refused: ${url}. Use the https:// version of the site.`,
    };
  }
  return { ok: true };
}

/**
 * Check a planned navigation. Returns { ok: true } or
 * { ok: false, reason: "..." } with a user-facing refusal message.
 */
export function checkNavigation(url) {
  if (!url || typeof url !== "string") {
    return { ok: false, reason: "Payment blocked: no URL given." };
  }
  if (!isAllowedUrl(url)) {
    return {
      ok: false,
      reason: `Blocked: only http:// and https:// URLs are allowed (got ${url}). file:// and chrome:// are never allowed.`,
    };
  }
  // Wave 3: HTTPS-only (http allowed only for localhost).
  const secure = checkSecureUrl(url);
  if (!secure.ok) return secure;
  if (isPaymentUrl(url)) {
    return {
      ok: false,
      reason:
        "Payment blocked: this skill never pays. Navigation to a checkout/payment URL was refused.",
    };
  }
  return { ok: true };
}

/**
 * Check a planned click / interaction against the current URL and the
 * element's visible text. Returns { ok: true } or { ok: false, reason }.
 */
export function checkAction({ url, text } = {}) {
  if (url && isPaymentUrl(url)) {
    return {
      ok: false,
      reason:
        "Payment blocked: this skill never pays. The current page is a checkout/payment page.",
    };
  }
  if (text && containsPaymentText(text)) {
    return {
      ok: false,
      reason:
        "Payment blocked: this skill never pays. That element looks like part of a payment form or a pay button.",
    };
  }
  return { ok: true };
}

/**
 * Check text the agent wants to type/fill. Refuses card-like numbers and
 * payment-form fields. Returns { ok: true } or { ok: false, reason }.
 */
export function checkTyping(text) {
  if (text == null) return { ok: true };
  if (isCardNumber(String(text))) {
    return {
      ok: false,
      reason:
        "Payment blocked: this skill never pays and never types card numbers. A card-like number (13-19 digits) was refused.",
    };
  }
  if (containsPaymentText(String(text))) {
    return {
      ok: false,
      reason:
        "Payment blocked: this skill never pays. That text looks like payment-form content.",
    };
  }
  return { ok: true };
}

export const PAYMENT_REFUSAL =
  "Payment blocked: this skill never pays.";

// ---------------------------------------------------------------------------
// Wave 2: sensitive actions, domain lists, step limit
// ---------------------------------------------------------------------------

// Words that mark an action as sensitive: deleting, sending, or publishing
// something. Matched as whole words. Bare "post" is deliberately NOT in the
// regex: links like "View post" are navigation, not publishing, and blocking
// them would break ordinary browsing; "Publish" buttons are still caught.
export const SENSITIVE_PATTERNS = [
  "delete",
  "remove",
  "send",
  "publish",
  "confirm delete",
  "delete account",
  "remove account",
];

const SENSITIVE_RE = /\b(delete|remove|send|publish)\b/i;

/** Return the matched sensitive word, or null when the text is not sensitive. */
export function sensitiveWord(text) {
  if (!text) return null;
  const m = String(text).match(SENSITIVE_RE);
  return m ? m[1].toLowerCase() : null;
}

/** True when the text looks like a sensitive action (delete/send/publish). */
export function isSensitiveText(text) {
  return sensitiveWord(text) !== null;
}

/**
 * Check a planned sensitive action. Returns { ok: true } or
 * { ok: false, reason }. Pass allowSensitive=true only when the operator
 * explicitly enabled LIVE_BROWSER_ALLOW_SENSITIVE=1.
 */
export function checkSensitive(text, allowSensitive = false) {
  const word = sensitiveWord(text);
  if (!word) return { ok: true };
  if (allowSensitive) return { ok: true, sensitive: word };
  return {
    ok: false,
    sensitive: word,
    reason:
      `Sensitive action blocked: "${word}" needs a human's approval. ` +
      `Set LIVE_BROWSER_ALLOW_SENSITIVE=1 to allow it, or do it yourself in the browser.`,
  };
}

/** Parse a comma-separated domain list env value into lowercase hostnames. */
export function parseDomainList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0])
    .filter(Boolean);
}

/** True when hostname matches a list entry exactly or as a subdomain. */
export function matchesDomain(hostname, list) {
  const host = String(hostname || "").toLowerCase();
  return (list || []).some((entry) => host === entry || host.endsWith(`.${entry}`));
}

/**
 * Check a URL against allow/block domain lists.
 * Blocked wins. When the allow list is non-empty, only listed hosts pass.
 * Empty lists = no restriction. Returns { ok: true } or { ok: false, reason }.
 */
export function checkDomains(url, allowed = [], blocked = []) {
  let host;
  try {
    host = new URL(String(url)).hostname;
  } catch {
    return { ok: false, reason: `Blocked: not a valid URL (${url}).` };
  }
  if (!host) return { ok: true }; // about:blank and similar have no host to check
  if (matchesDomain(host, blocked)) {
    return { ok: false, reason: `Blocked: domain ${host} is on the block list.` };
  }
  if (allowed.length > 0 && !matchesDomain(host, allowed)) {
    return { ok: false, reason: `Blocked: domain ${host} is not on the allow list.` };
  }
  return { ok: true };
}

/** Step-limit check. Returns { ok: true } or { ok: false, reason }. */
export function checkStepLimit(count, maxSteps) {
  if (count >= maxSteps) {
    return {
      ok: false,
      reason:
        `Step limit reached: ${count}/${maxSteps} steps used. ` +
        `The browser stops here to prevent runaway sessions. ` +
        `Raise LIVE_BROWSER_MAX_STEPS or restart the server for a new session.`,
    };
  }
  return { ok: true };
}
