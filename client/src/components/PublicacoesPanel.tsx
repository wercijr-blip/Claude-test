import { trpc } from "../lib/trpc.ts";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  rascunho:   { label: "Rascunho",   cls: "bg-stone-100 text-stone-500" },
  em_revisao: { label: "Em revisão", cls: "bg-blue-50 text-blue-600" },
  submetido:  { label: "Submetido",  cls: "bg-indigo-50 text-indigo-600" },
  aceito:     { label: "Aceito",     cls: "bg-emerald-50 text-emerald-600" },
  publicado:  { label: "Publicado",  cls: "bg-green-50 text-green-700 font-semibold" },
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
    <section>
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-400">
          Produções científicas
        </p>
        {items.length > 0 && (
          <span className="text-[11px] text-stone-300">
            {items.length} produção{items.length > 1 ? "ões" : ""}
          </span>
        )}
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
        {isLoading && (
          <div className="px-4 py-3 space-y-2 animate-pulse">
            <div className="h-12 bg-stone-100 rounded-xl" />
            <div className="h-12 bg-stone-100 rounded-xl" />
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-stone-400">Nenhuma produção gerada ainda.</p>
            <p className="text-[11px] text-stone-300 mt-1.5 leading-relaxed max-w-xs mx-auto">
              Após 3 consultas com o mesmo diagnóstico o CIS gera automaticamente uma série de casos.
            </p>
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <ul className="divide-y divide-stone-100">
            {items.map((pub) => {
              const status = STATUS_CONFIG[pub.status] ?? STATUS_CONFIG.rascunho;
              const tipo = TIPO_LABEL[pub.tipo] ?? pub.tipo;
              const titulo = pub.titulo ?? pub.diagnostico ?? pub.tema ?? "—";
              const meta =
                pub.tipo === "serie_casos"
                  ? `${pub.nCasos ?? 0} caso${(pub.nCasos ?? 0) !== 1 ? "s" : ""}`
                  : `${pub.nArtigos ?? 0} artigo${(pub.nArtigos ?? 0) !== 1 ? "s" : ""}`;
              const criadoEm = new Date(pub.createdAt).toLocaleDateString("pt-BR");

              return (
                <li key={pub.id} className="px-4 py-3.5 flex items-start gap-3 hover:bg-stone-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-stone-400">{tipo}</span>
                      {pub.cid10 && (
                        <span className="text-[11px] font-mono bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">
                          {pub.cid10}
                        </span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${status.cls}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-stone-700 mt-0.5 truncate">
                      {titulo}
                    </p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
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
    </section>
  );
}
