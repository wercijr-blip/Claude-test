import { z } from "zod";

export const paginationInput = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.number().int().positive().optional(),
});

export type PaginationInput = z.infer<typeof paginationInput>;

export function paginatedResponse<T extends { id: number }>(
  items: T[],
  limit: number,
) {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  return {
    data,
    nextCursor: hasMore ? data[data.length - 1]?.id : undefined,
    hasMore,
  };
}
