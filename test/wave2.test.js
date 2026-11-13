import test from "node:test";
import assert from "node:assert/strict";
import {
  checkDomains,
  checkSensitive,
  checkStepLimit,
  isSensitiveText,
  matchesDomain,
  parseDomainList,
  sensitiveWord,
} from "../server/guard.js";

// --- Sensitive actions -----------------------------------------------------

test("sensitive words are detected as whole words", () => {
  assert.equal(sensitiveWord("Delete account"), "delete");
  assert.equal(sensitiveWord("Send message"), "send");
  assert.equal(sensitiveWord("Publish post"), "publish");
  assert.equal(sensitiveWord("Remove item"), "remove");
  // Substrings must NOT match: "sender" is not "send", "deleted" is not "delete".
  assert.equal(sensitiveWord("sender address"), null);
  assert.equal(sensitiveWord("deleted items"), null);
  assert.equal(sensitiveWord("Sign in"), null);
  assert.equal(sensitiveWord("Read more"), null);
  // "View post" is navigation, not publishing — deliberately allowed.
  assert.equal(sensitiveWord("View post"), null);
});

test("sensitive actions are refused unless explicitly allowed", () => {
  assert.equal(isSensitiveText("Delete"), true);
  assert.equal(isSensitiveText("Continue"), false);
  const blocked = checkSensitive("Delete this page", false);
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /Sensitive action blocked/);
  assert.equal(checkSensitive("Delete this page", true).ok, true);
  assert.equal(checkSensitive("Continue", false).ok, true);
});

// --- Domain allow/block lists ----------------------------------------------

test("parseDomainList splits and normalises", () => {
  assert.deepEqual(parseDomainList(""), []);
  assert.deepEqual(parseDomainList("example.com, sub.test.org "), ["example.com", "sub.test.org"]);
  assert.deepEqual(parseDomainList("https://Example.COM/path"), ["example.com"]);
});

test("matchesDomain covers subdomains", () => {
  assert.equal(matchesDomain("example.com", ["example.com"]), true);
  assert.equal(matchesDomain("www.example.com", ["example.com"]), true);
  assert.equal(matchesDomain("notexample.com", ["example.com"]), false);
  assert.equal(matchesDomain("example.com.evil.com", ["example.com"]), false);
});

test("blocked domains win, allow list restricts", () => {
  assert.equal(checkDomains("https://ads.example.com/", [], ["example.com"]).ok, false);
  assert.equal(checkDomains("https://example.com/", ["example.com"], []).ok, true);
  assert.equal(checkDomains("https://other.com/", ["example.com"], []).ok, false);
  assert.equal(checkDomains("https://www.example.com/", ["example.com"], []).ok, true);
  // Blocked beats allowed.
  assert.equal(checkDomains("https://example.com/", ["example.com"], ["example.com"]).ok, false);
  // Empty lists = no restriction.
  assert.equal(checkDomains("https://anything.com/", [], []).ok, true);
  // Hostless URLs (about:blank) are not domain-checked.
  assert.equal(checkDomains("about:blank", ["example.com"], []).ok, true);
});

// --- Step limit --------------------------------------------------------------

test("step limit refuses at the limit and allows below it", () => {
  assert.equal(checkStepLimit(0, 100).ok, true);
  assert.equal(checkStepLimit(99, 100).ok, true);
  assert.equal(checkStepLimit(100, 100).ok, false);
  assert.match(checkStepLimit(100, 100).reason, /Step limit reached: 100\/100/);
  assert.equal(checkStepLimit(5, 5).ok, false);
});
