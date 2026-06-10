import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers.ts";

export const trpc = createTRPCReact<AppRouter>();

// Tipos de saída inferidos do router — use em props de componentes em vez de any.
// Ex.: RouterOutputs["consulta"]["medico"]["listarRevisoes"][number]
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export function createTrpcClient(getToken: () => string | null) {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/trpc",
        headers: () => {
          const token = getToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
