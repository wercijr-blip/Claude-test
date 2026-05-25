import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { OfflineIndicator } from "./OfflineIndicator";

const originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");

describe("OfflineIndicator — acessibilidade", () => {
  beforeAll(() => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
      writable: true,
    });
  });

  afterAll(() => {
    if (originalOnLine) {
      Object.defineProperty(navigator, "onLine", originalOnLine);
    }
  });

  it("não tem violações de acessibilidade quando visível", async () => {
    const { container } = render(<OfflineIndicator />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it('renderiza com role="status" e aria-live="polite"', () => {
    const { container } = render(<OfflineIndicator />);
    const el = container.querySelector('[role="status"]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute("aria-live")).toBe("polite");
  });

  it('ícone decorativo tem aria-hidden="true"', () => {
    const { container } = render(<OfflineIndicator />);
    const icon = container.querySelector('[aria-hidden="true"]');
    expect(icon).not.toBeNull();
  });

  it("exibe mensagem de conexão perdida", () => {
    const { getByText } = render(<OfflineIndicator />);
    expect(getByText(/sem conexão/i)).toBeDefined();
  });
});

describe("OfflineIndicator — online", () => {
  it("não renderiza quando online", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
      writable: true,
    });
    const { container } = render(<OfflineIndicator />);
    expect(container.querySelector('[role="status"]')).toBeNull();
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
      writable: true,
    });
  });
});
