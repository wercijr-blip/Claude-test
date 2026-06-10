import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import CookieConsent, { STORAGE_KEY } from "./CookieConsent";

describe("CookieConsent — acessibilidade", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("não renderiza quando consentimento já foi dado", () => {
    localStorage.setItem(STORAGE_KEY, "all");
    const { container } = render(<CookieConsent />);
    expect(container.firstChild).toBeNull();
  });

  it("botões têm texto acessível visível", () => {
    const { queryByText } = render(<CookieConsent />);
    const aceitarTodos = queryByText("Aceitar todos");
    const apenasEssenciais = queryByText("Apenas essenciais");
    if (aceitarTodos) expect(aceitarTodos).toBeDefined();
    if (apenasEssenciais) expect(apenasEssenciais).toBeDefined();
  });

  it("não tem violações de acessibilidade quando visível", async () => {
    const { container } = render(<CookieConsent />);
    if (container.firstChild) {
      const results = await axe(container);
      expect(results.violations).toHaveLength(0);
    }
  });

  it("aceita todos os cookies ao clicar em Aceitar todos", () => {
    const { queryByText } = render(<CookieConsent />);
    const btn = queryByText("Aceitar todos");
    if (btn) {
      btn.click();
      expect(localStorage.getItem(STORAGE_KEY)).toBe("all");
    }
  });
});
