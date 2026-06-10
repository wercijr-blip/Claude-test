import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { EmptyState } from "./EmptyState";

describe("EmptyState — acessibilidade", () => {
  it("não tem violações de acessibilidade", async () => {
    const { container } = render(
      <EmptyState message="Nenhum item encontrado." />,
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it("exibe a mensagem como texto visível", () => {
    const { getByText } = render(<EmptyState message="Lista vazia" />);
    expect(getByText("Lista vazia")).toBeDefined();
  });

  it("não renderiza wrapper de ícone quando icon ausente", () => {
    const { container } = render(<EmptyState message="Sem dados" />);
    expect(container.querySelector(".mb-3")).toBeNull();
  });

  it("não tem violações mesmo com ícone", async () => {
    const icon = <span aria-hidden="true">📭</span>;
    const { container } = render(
      <EmptyState message="Sem resultados" icon={icon} />,
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it("aceita className customizada", () => {
    const { container } = render(<EmptyState message="Ok" className="py-4" />);
    expect(container.firstChild).toBeDefined();
  });
});
