import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLoggerInfo = vi.fn();

vi.mock("./_core/logger.ts", () => ({
  logger: { info: mockLoggerInfo, error: vi.fn(), warn: vi.fn() },
}));

const { logAudit } = await import("./_core/audit.ts");

describe("logAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs user.login action with actor info", () => {
    logAudit({
      actorId: 1,
      actorRole: "medico",
      action: "user.login",
      resourceType: "user",
      resourceId: 1,
    });

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "[audit]",
      expect.objectContaining({
        actor: 1,
        role: "medico",
        action: "user.login",
        resource: "user",
        resourceId: 1,
      }),
    );
  });

  it("logs soap.create action", () => {
    logAudit({
      actorId: 5,
      actorRole: "admin",
      action: "soap.create",
      resourceType: "soap_note",
      resourceId: 99,
    });

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "[audit]",
      expect.objectContaining({ action: "soap.create", resourceId: 99 }),
    );
  });

  it("includes detalhes in log output", () => {
    logAudit({
      actorId: 2,
      actorRole: "medico",
      action: "alert.feedback",
      resourceType: "conduct_alert",
      resourceId: 7,
      detalhes: { feedback: "concordo" },
    });

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "[audit]",
      expect.objectContaining({ feedback: "concordo" }),
    );
  });

  it("works without optional fields", () => {
    expect(() =>
      logAudit({
        action: "data.export",
        resourceType: "medico",
      }),
    ).not.toThrow();

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "[audit]",
      expect.objectContaining({ action: "data.export" }),
    );
  });

  it("logs alert.suppress action", () => {
    logAudit({
      actorId: 3,
      actorRole: "medico",
      action: "alert.suppress",
      resourceType: "conduct_alert",
      resourceId: 12,
      detalhes: { dias: 30, supressaoAte: new Date("2026-06-01") },
    });

    expect(mockLoggerInfo).toHaveBeenCalledTimes(1);
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "[audit]",
      expect.objectContaining({ action: "alert.suppress", dias: 30 }),
    );
  });

  it("logs data.portability_request action", () => {
    logAudit({
      actorId: 1,
      actorRole: "medico",
      action: "data.portability_request",
      resourceType: "medico",
      resourceId: 1,
      ipAddress: "127.0.0.1",
    });

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "[audit]",
      expect.objectContaining({
        action: "data.portability_request",
        ip: "127.0.0.1",
      }),
    );
  });
});
