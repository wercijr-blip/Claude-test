import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CircuitBreaker } from "./circuitBreaker.ts";

describe("CircuitBreaker — estados", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("começa fechado e permite requisições", () => {
    const cb = new CircuitBreaker("test", 3, 1000);
    expect(cb.isOpen()).toBe(false);
  });

  it("abre após maxFailures consecutivas", () => {
    const cb = new CircuitBreaker("test", 3, 1000);
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen()).toBe(false); // ainda fechado (2 < 3)
    cb.recordFailure();
    expect(cb.isOpen()).toBe(true); // agora aberto (3 >= 3)
  });

  it("permanece aberto antes de resetMs", () => {
    const cb = new CircuitBreaker("test", 2, 5000);
    cb.recordFailure();
    cb.recordFailure();
    vi.advanceTimersByTime(4999);
    expect(cb.isOpen()).toBe(true);
  });

  it("transiciona para half-open após resetMs", () => {
    const cb = new CircuitBreaker("test", 2, 1000);
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen()).toBe(true);
    vi.advanceTimersByTime(1001);
    expect(cb.isOpen()).toBe(false); // half-open: permite trial
  });

  it("fecha completamente após recordSuccess", () => {
    const cb = new CircuitBreaker("test", 2, 1000);
    cb.recordFailure();
    cb.recordFailure();
    vi.advanceTimersByTime(1001);
    cb.isOpen(); // entra em half-open
    cb.recordSuccess();
    expect(cb.isOpen()).toBe(false);
    // Após sucesso, failures = 0, deve continuar fechado mesmo sem avançar tempo
    cb.recordFailure();
    expect(cb.isOpen()).toBe(false); // 1 falha < maxFailures=2
  });

  it("volta a aberto quando trial em half-open falha", () => {
    const cb = new CircuitBreaker("test", 2, 1000);
    cb.recordFailure();
    cb.recordFailure();
    vi.advanceTimersByTime(1001);
    cb.isOpen(); // transiciona para half-open (failures = 1)
    cb.recordFailure(); // trial falha → volta para open (failures = 2)
    expect(cb.isOpen()).toBe(true);
  });

  it("trial falhado usa halfOpenAt como base, não o instante da falha", () => {
    const cb = new CircuitBreaker("test", 2, 1000);
    cb.recordFailure();
    cb.recordFailure();
    vi.advanceTimersByTime(1001); // t=1001ms

    cb.isOpen(); // entra half-open, halfOpenAt = 1001ms

    // Trial demora 500ms e falha
    vi.advanceTimersByTime(500); // t=1501ms
    cb.recordFailure(); // lastFailureAt = halfOpenAt = 1001ms (não 1501ms)

    // Sem a correção, lastFailureAt seria 1501ms, exigiria mais 1000ms (até t=2501ms)
    // Com a correção, lastFailureAt = 1001ms, então t=2002ms já seria suficiente
    vi.advanceTimersByTime(500); // t=2001ms — ainda em aberto (2001 - 1001 = 1000, não > 1000)
    expect(cb.isOpen()).toBe(true);

    vi.advanceTimersByTime(2); // t=2003ms — (2003 - 1001 = 1002 > 1000) → half-open
    expect(cb.isOpen()).toBe(false);
  });

  it("recordSuccess reseta halfOpenAt", () => {
    const cb = new CircuitBreaker("test", 2, 1000);
    cb.recordFailure();
    cb.recordFailure();
    vi.advanceTimersByTime(1001);
    cb.isOpen(); // half-open
    cb.recordSuccess(); // deve resetar tudo
    // Após sucesso, uma nova falha não deve abrir imediatamente
    cb.recordFailure();
    expect(cb.isOpen()).toBe(false); // 1 < maxFailures=2
  });
});
