/**
 * Scheduler - OpenTelemetry Tracing Init
 *
 * IMPORTANT: This file must be imported BEFORE any other module imports.
 * In production, use Node.js --require flag:
 *   node --require ./dist/tracing.js ./dist/index.js
 *
 * Required packages (add to scheduler/package.json):
 *   "@opentelemetry/sdk-node": "^0.57.0"
 *   "@opentelemetry/api": "^1.9.0"
 *   "@opentelemetry/exporter-trace-otlp-grpc": "^0.57.0"
 *   "@opentelemetry/resources": "^1.30.0"
 *   "@opentelemetry/semantic-conventions": "^1.30.0"
 *   "@opentelemetry/instrumentation-http": "^0.57.0"
 *   "@opentelemetry/instrumentation-fastify": "^0.43.0"
 *   "@opentelemetry/instrumentation-pg": "^0.49.0"
 *   "@opentelemetry/instrumentation-ioredis": "^0.47.0"
 *   "@opentelemetry/instrumentation-express": "^0.46.0"
 */

// Tracing disabled for now - requires @landomo/core setup
// import { initTracing } from '@landomo/core';
//
// initTracing({
//   serviceName: 'scheduler',
//   otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://jaeger:4317',
// });

console.log('Scheduler starting without tracing');
