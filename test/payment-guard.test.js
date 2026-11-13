import test from "node:test";
import assert from "node:assert/strict";
import {
  checkAction,
  checkNavigation,
  checkTyping,
  containsPaymentText,
  isAllowedUrl,
  isCardNumber,
  isPaymentUrl,
} from "../server/guard.js";

test("blocks checkout / payment URLs", () => {
  for (const url of [
    "https://example.com/checkout",
    "https://example.com/cart/checkout?x=1",
    "https://example.com/pay",
    "https://example.com/payment",
    "https://example.com/payments/123",
    "https://checkout.stripe.com/pay/abc",
    "https://www.paypal.com/checkoutnow",
    "https://example.com/billing",
    "https://example.com/subscribe",
  ]) {
    assert.equal(isPaymentUrl(url), true, url);
    assert.equal(checkNavigation(url).ok, false, url);
  }
});

test("allows normal URLs", () => {
  for (const url of [
    "https://example.com/",
    "https://example.com/pricing",
    "https://example.com/products/shoes",
    "https://news.ycombinator.com/",
    "http://localhost:3000/dashboard",
  ]) {
    assert.equal(isPaymentUrl(url), false, url);
    assert.equal(checkNavigation(url).ok, true, url);
  }
});

test("blocks non-http(s) URLs", () => {
  assert.equal(isAllowedUrl("file:///etc/passwd"), false);
  assert.equal(isAllowedUrl("chrome://settings"), false);
  assert.equal(isAllowedUrl("javascript:alert(1)"), false);
  assert.equal(checkNavigation("file:///etc/passwd").ok, false);
  assert.equal(checkNavigation("not a url").ok, false);
});

test("blocks card-like numbers in typing", () => {
  for (const text of [
    "4242424242424242",
    "4242 4242 4242 4242",
    "4242-4242-4242-4242",
    "5555555555554444",
    "378282246310005",
  ]) {
    assert.equal(isCardNumber(text), true, text);
    assert.equal(checkTyping(text).ok, false, text);
    assert.match(checkTyping(text).reason, /Payment blocked/);
  }
});

test("allows normal text in typing", () => {
  for (const text of [
    "hello world",
    "my email is test@example.com",
    "order 12345",
    "call me on 0123456789",
    "password123",
  ]) {
    assert.equal(checkTyping(text).ok, true, text);
  }
});

test("blocks payment text in clicks / actions", () => {
  assert.equal(containsPaymentText("Pay now"), true);
  assert.equal(containsPaymentText("Confirm payment"), true);
  assert.equal(containsPaymentText("Card number"), true);
  assert.equal(containsPaymentText("Enter your CVV"), true);
  assert.equal(containsPaymentText("Sign in"), false);
  assert.equal(containsPaymentText("Add to cart"), false);
  assert.equal(checkAction({ url: "https://example.com/", text: "Pay now" }).ok, false);
  assert.equal(checkAction({ url: "https://example.com/checkout", text: "Continue" }).ok, false);
  assert.equal(checkAction({ url: "https://example.com/", text: "Read more" }).ok, true);
});

test("refusal message is the canonical payment-blocked message", () => {
  assert.match(checkNavigation("https://example.com/checkout").reason, /Payment blocked: this skill never pays/);
  assert.match(checkTyping("4242424242424242").reason, /Payment blocked: this skill never pays/);
});
