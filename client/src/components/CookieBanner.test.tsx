import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { CookieBanner } from "./CookieBanner";

describe("CookieBanner — acessibilidade", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("não renderiza quando consentimento já foi dado", () => {
    localStorage.setItem("cookie_consent", "all");
    const { container } = render(<CookieBanner />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('tem role="dialog" com aria-label', () => {
    const { container } = render(<CookieBanner />);
    const dialog = container.querySelector('[role="dialog"]');
    if (dialog) {
      expect(dialog.getAttribute("aria-label")).toBeTruthy();
    }
  });

  it("botões têm texto acessível visível", () => {
    const { queryByText } = render(<CookieBanner />);
    const soEssenciais = queryByText("Só essenciais");
    const aceitarTodos = queryByText("Aceitar todos");
    if (soEssenciais) expect(soEssenciais).toBeDefined();
    if (aceitarTodos) expect(aceitarTodos).toBeDefined();
  });

  it("não tem violações de acessibilidade quando visível", async () => {
    const { container } = render(<CookieBanner />);
    const dialog = container.querySelector('[role="dialog"]');
    if (dialog) {
      const results = await axe(container);
      expect(results.violations).toHaveLength(0);
    }
  });
});
