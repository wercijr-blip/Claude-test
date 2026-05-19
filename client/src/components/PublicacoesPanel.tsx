import { trpc } from "../lib/trpc.ts";

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  rascunho:    { label: "Rascunho",    cls: "bg-slate-100 text-slate-600" },
  em_revisao:  { label: "Em revisão",  cls: "bg-blue-100 text-blue-700" },
  submetido:   { label: "Submetido",   cls: "bg-indigo-100 text-indigo-700" },
  aceito:      { label: "Aceito",      cls: "bg-emerald-100 text-emerald-700" },
  publicado:   { label: "Publicado",   cls: "bg-green-100 text-green-700" },
};

const TIPO_LABEL: Record<string, string> = {
  serie_casos:        "Série de casos",
  revisao_literatura: "Revisão de literatura",
};

export default function PublicacoesPanel() {
  const { data, isLoading } = trpc.scriba.listarPublicacoes.useQuery(
    { limit: 10 },
    { retry: false },
  );

  const items = data?.items ?? [];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700">
          Produções Científicas
        </h2>
        {items.length > 0 && (
          <span className="text-xs text-slate-400">{items.length} produção{items.length > 1 ? "ões" : ""}</span>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2 animate-pulse">
          <div className="h-12 bg-slate-100 rounded-xl" />
          <div className="h-12 bg-slate-100 rounded-xl" />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="text-center py-6 space-y-2">
          <p className="text-sm text-slate-400">
            Nenhuma produção científica gerada ainda.
          </p>
          <p className="text-xs text-slate-300 leading-relaxed">
            Após <strong>3 consultas</strong> com o mesmo diagnóstico, o CIS gera
            automaticamente uma série de casos. Revisões de literatura podem ser
            solicitadas manualmente.
          </p>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {items.map((pub) => {
            const status = STATUS_STYLE[pub.status] ?? STATUS_STYLE.rascunho;
            const tipo = TIPO_LABEL[pub.tipo] ?? pub.tipo;
            const titulo = pub.titulo ?? pub.diagnostico ?? pub.tema ?? "—";
            const meta =
              pub.tipo === "serie_casos"
                ? `${pub.nCasos ?? 0} caso${(pub.nCasos ?? 0) !== 1 ? "s" : ""}`
                : `${pub.nArtigos ?? 0} artigo${(pub.nArtigos ?? 0) !== 1 ? "s" : ""}`;
            const criadoEm = new Date(pub.createdAt).toLocaleDateString("pt-BR");

            return (
              <li key={pub.id} className="py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-400">{tipo}</span>
                    {pub.cid10 && (
                      <span className="text-xs font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                        {pub.cid10}
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-700 mt-0.5 truncate">
                    {titulo}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {meta} · {criadoEm}
                    {pub.jornal ? ` · ${pub.jornal}` : ""}
                    {pub.doi ? (
                      <>
                        {" · "}
                        <a
                          href={`https://doi.org/${pub.doi}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          DOI
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
