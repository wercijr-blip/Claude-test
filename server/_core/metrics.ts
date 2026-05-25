import { Registry, Counter, Gauge, collectDefaultMetrics } from "prom-client";

export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry, prefix: "fp_" });

export const llmCallsTotal = new Counter({
  name: "fp_llm_calls_total",
  help: "Total LLM API calls by status",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
});

export const llmDailyUsage = new Gauge({
  name: "fp_llm_daily_usage",
  help: "LLM calls made today",
  registers: [metricsRegistry],
});

export const queueWaiting = new Gauge({
  name: "fp_queue_waiting",
  help: "BullMQ jobs waiting per queue",
  labelNames: ["queue"] as const,
  registers: [metricsRegistry],
});

export const queueFailed = new Gauge({
  name: "fp_queue_failed",
  help: "BullMQ jobs failed per queue",
  labelNames: ["queue"] as const,
  registers: [metricsRegistry],
});

export const dlqTotal = new Gauge({
  name: "fp_dlq_total",
  help: "Total jobs in dead letter queue",
  registers: [metricsRegistry],
});

export const httpRequestDuration = new Gauge({
  name: "fp_http_request_duration_ms_last",
  help: "Duration of last HTTP request in ms (sampled)",
  labelNames: ["method", "status"] as const,
  registers: [metricsRegistry],
});
