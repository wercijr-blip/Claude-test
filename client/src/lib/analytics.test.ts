import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  persistUtms,
  getStoredUtms,
  generateEventId,
  trackPageView,
  trackPurchase,
  initScrollDepth,
} from "./analytics.ts";

// jsdom provides window/document; set up sessionStorage mock
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "sessionStorage", { value: sessionStorageMock });

// ─── UTM persistence ──────────────────────────────────────────────────────────

describe("persistUtms", () => {
  beforeEach(() => sessionStorageMock.clear());

  it("stores UTMs from the URL", () => {
    Object.defineProperty(window, "location", {
      value: { search: "?utm_source=google&utm_medium=cpc&utm_campaign=prep" },
      writable: true,
    });
    persistUtms();
    const stored = getStoredUtms();
    expect(stored.utm_source).toBe("google");
    expect(stored.utm_medium).toBe("cpc");
    expect(stored.utm_campaign).toBe("prep");
  });

  it("does not overwrite stored UTMs when URL has no UTMs", () => {
    sessionStorageMock.setItem(
      "_fp_utms",
      JSON.stringify({ utm_source: "facebook" }),
    );
    Object.defineProperty(window, "location", {
      value: { search: "" },
      writable: true,
    });
    persistUtms();
    const stored = getStoredUtms();
    expect(stored.utm_source).toBe("facebook");
  });

  it("ignores non-UTM query params", () => {
    Object.defineProperty(window, "location", {
      value: { search: "?ref=homepage&foo=bar" },
      writable: true,
    });
    persistUtms();
    const stored = getStoredUtms();
    expect(Object.keys(stored)).toHaveLength(0);
  });
});

describe("getStoredUtms", () => {
  beforeEach(() => sessionStorageMock.clear());

  it("returns empty object when nothing stored", () => {
    expect(getStoredUtms()).toEqual({});
  });

  it("returns empty object on malformed JSON", () => {
    sessionStorageMock.setItem("_fp_utms", "not-json{{{");
    expect(getStoredUtms()).toEqual({});
  });
});

// ─── generateEventId ──────────────────────────────────────────────────────────

describe("generateEventId", () => {
  it("returns a non-empty string", () => {
    expect(generateEventId()).toBeTruthy();
    expect(typeof generateEventId()).toBe("string");
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateEventId()));
    expect(ids.size).toBe(100);
  });

  it("starts with fp- prefix", () => {
    expect(generateEventId()).toMatch(/^fp-/);
  });
});

// ─── dataLayer events ─────────────────────────────────────────────────────────

describe("trackPageView", () => {
  beforeEach(() => {
    window.dataLayer = [];
  });

  it("pushes page_view event to dataLayer", () => {
    trackPageView("/paciente");
    expect(window.dataLayer.some((e) => e.event === "page_view")).toBe(true);
  });

  it("includes page_path in the event", () => {
    trackPageView("/intake");
    const evt = window.dataLayer.find((e) => e.event === "page_view");
    expect(evt?.page_path).toBe("/intake");
  });
});

describe("trackPurchase", () => {
  beforeEach(() => {
    window.dataLayer = [];
    sessionStorageMock.clear();
  });

  it("pushes purchase event with correct fields", () => {
    trackPurchase("order-123", 150);
    const evt = window.dataLayer.find((e) => e.event === "purchase");
    expect(evt).toBeDefined();
    expect(evt?.transaction_id).toBe("order-123");
    expect(evt?.value).toBe(150);
    expect(evt?.currency).toBe("BRL");
    expect(evt?.event_id).toMatch(/^fp-/);
  });

  it("includes UTMs when they are stored", () => {
    sessionStorageMock.setItem(
      "_fp_utms",
      JSON.stringify({ utm_source: "meta" }),
    );
    trackPurchase("order-456", 150);
    const evt = window.dataLayer.find((e) => e.event === "purchase");
    expect(evt?.utm_source).toBe("meta");
  });

  it("pushes enhanced_conversion_data when email is provided", () => {
    trackPurchase("order-789", 150, "patient@test.com");
    const ecEvt = window.dataLayer.find(
      (e) => e.event === "enhanced_conversion_data",
    );
    expect(ecEvt?.enhanced_conversion_data).toMatchObject({
      email: "patient@test.com",
    });
  });
});

// ─── initScrollDepth ─────────────────────────────────────────────────────────

describe("initScrollDepth", () => {
  afterEach(() => {
    window.__fp_scroll_attached__ = false;
  });

  it("does not attach a second listener when called twice", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    initScrollDepth();
    initScrollDepth();
    const scrollCalls = addSpy.mock.calls.filter((c) => c[0] === "scroll");
    expect(scrollCalls.length).toBeLessThanOrEqual(1);
    addSpy.mockRestore();
  });
});
