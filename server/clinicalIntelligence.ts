// Barrel — re-exports all CIS modules for backward compatibility.
// Callers import from this file; split is transparent to them.
export * from "./cis/client.ts";
export * from "./cis/extractors.ts";
export * from "./cis/medscribe.ts";
export * from "./cis/synthesis.ts";
export * from "./cis/reporting.ts";
export * from "./cis/alert.ts";
export * from "./cis/digests.ts";
export * from "./cis/publications.ts";
