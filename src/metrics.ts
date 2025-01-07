import { Counter, Histogram, type Registry } from "prom-client";

export const requestsCount = new Counter({
	name: "http_client_requests_total",
	help: "Total number of http client requests",
	labelNames: ["base", "method", "path", "code"],
	registers: [],
});

export const requestDuration = new Histogram({
	name: "http_client_request_duration_seconds",
	help: "Latencies for http client requests",
	labelNames: ["base", "method", "path"],
	registers: [],
});

export const requestStageDuration = new Histogram({
	name: "http_client_request_stage_duration_seconds",
	help: "Latencies for http client requests",
	labelNames: ["base", "stage"],
	registers: [],
});

export function registerMetrics(registry: Registry) {
	registry.registerMetric(requestsCount);
	registry.registerMetric(requestDuration);
	registry.registerMetric(requestStageDuration);
}
