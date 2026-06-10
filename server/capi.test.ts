import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "crypto";

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockEnv = {
  META_PIXEL_ID: undefined as string | undefined,
  META_CAPI_TOKEN: undefined as string | undefined,
  APP_URL: "https://www.facilitaprep.com.br",
  NODE_ENV: "test" as const,
};

vi.mock("./_core/env.ts", () => ({ env: mockEnv }));

vi.mock("./_core/logger.ts", () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sha256(value: string): string {
  return createHash("sha256").update(value.toLowerCase().trim()).digest("hex");
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("sendCapiEvent", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ events_received: 1 }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockEnv.META_PIXEL_ID = undefined;
    mockEnv.META_CAPI_TOKEN = undefined;
  });

  it("no-ops when META_PIXEL_ID is missing", async () => {
    mockEnv.META_PIXEL_ID = undefined;
    mockEnv.META_CAPI_TOKEN = "token";
    const { sendCapiEvent } = await import("./capi.ts");
    await sendCapiEvent({ eventName: "Lead", eventId: "test-1", userData: {} });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("no-ops when META_CAPI_TOKEN is missing", async () => {
    mockEnv.META_PIXEL_ID = "12345";
    mockEnv.META_CAPI_TOKEN = undefined;
    const { sendCapiEvent } = await import("./capi.ts");
    await sendCapiEvent({ eventName: "Lead", eventId: "test-2", userData: {} });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends event to Graph API when both env vars are set", async () => {
    mockEnv.META_PIXEL_ID = "12345";
    mockEnv.META_CAPI_TOKEN = "my-token";
    const { sendCapiEvent } = await import("./capi.ts");
    await sendCapiEvent({
      eventName: "Lead",
      eventId: "test-3",
      userData: { email: "user@example.com" },
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("graph.facebook.com");
    expect(url).toContain("12345");
    const body = JSON.parse(opts.body as string) as {
      data: Array<{ event_name: string; event_id: string }>;
      access_token: string;
    };
    expect(body.data[0].event_name).toBe("Lead");
    expect(body.data[0].event_id).toBe("test-3");
    expect(body.access_token).toBe("my-token");
  });

  it("hashes email with SHA-256 before sending", async () => {
    mockEnv.META_PIXEL_ID = "12345";
    mockEnv.META_CAPI_TOKEN = "my-token";
    const { sendCapiEvent } = await import("./capi.ts");
    const email = "Test@Example.com";
    await sendCapiEvent({
      eventName: "Lead",
      eventId: "test-4",
      userData: { email },
    });
    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string) as {
      data: Array<{ user_data: { em: string[] } }>;
    };
    expect(body.data[0].user_data.em[0]).toBe(sha256(email));
  });

  it("does not throw on network error", async () => {
    mockEnv.META_PIXEL_ID = "12345";
    mockEnv.META_CAPI_TOKEN = "my-token";
    fetchSpy.mockRejectedValue(new Error("Network failure"));
    const { sendCapiEvent } = await import("./capi.ts");
    await expect(
      sendCapiEvent({ eventName: "Lead", eventId: "test-5", userData: {} }),
    ).resolves.toBeUndefined();
  });

  it("does not throw on timeout (AbortError)", async () => {
    mockEnv.META_PIXEL_ID = "12345";
    mockEnv.META_CAPI_TOKEN = "my-token";
    fetchSpy.mockRejectedValue(
      new DOMException("The operation was aborted", "AbortError"),
    );
    const { sendCapiEvent } = await import("./capi.ts");
    await expect(
      sendCapiEvent({ eventName: "Lead", eventId: "test-6", userData: {} }),
    ).resolves.toBeUndefined();
  });
});

describe("sendCapiLead convenience wrapper", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    mockEnv.META_PIXEL_ID = undefined;
    mockEnv.META_CAPI_TOKEN = undefined;
  });

  it("resolves without throwing when env vars are set", async () => {
    mockEnv.META_PIXEL_ID = "12345";
    mockEnv.META_CAPI_TOKEN = "token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
    );
    const { sendCapiLead } = await import("./capi.ts");
    await expect(
      sendCapiLead({
        eventId: "l-1",
        email: "a@b.com",
        clientIp: "1.2.3.4",
        clientUserAgent: "ua",
      }),
    ).resolves.toBeUndefined();
  });
});
