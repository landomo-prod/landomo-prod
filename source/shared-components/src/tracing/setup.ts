/**
 * OpenTelemetry Distributed Tracing Setup
 *
 * Shared tracing initialization for all Landomo services.
 * Must be imported and called BEFORE any other imports in the service entry point
 * so that auto-instrumentation can patch modules before they are loaded.
 *
 * Required packages (add to package.json):
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

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';

export interface TracingConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  /** OTLP endpoint, defaults to OTEL_EXPORTER_OTLP_ENDPOINT or http://jaeger:4317 */
  otlpEndpoint?: string;
  /** Set false to disable tracing entirely (e.g. in tests). Defaults to true. */
  enabled?: boolean;
}

let sdk: NodeSDK | undefined;

/**
 * Initialize OpenTelemetry tracing.
 *
 * Call this once at the very top of your service entry point,
 * before importing Fastify, pg, ioredis, or any HTTP library.
 */
export function initTracing(config: TracingConfig): void {
  const enabled = config.enabled ?? (process.env.OTEL_TRACING_ENABLED !== 'false');
  if (!enabled) {
    return;
  }

  const endpoint =
    config.otlpEndpoint ||
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    'http://jaeger:4317';

  const environment = config.environment || process.env.NODE_ENV || 'development';

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.serviceName,
    [ATTR_SERVICE_VERSION]: config.serviceVersion || '1.0.0',
    'deployment.environment.name': environment,
  });

  const traceExporter = new OTLPTraceExporter({
    url: endpoint,
  });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      new HttpInstrumentation({
        // Don't trace health checks to reduce noise
        ignoreIncomingRequestHook: (request) => {
          return request.url === '/health' || request.url === '/api/v1/health';
        },
      }),
      new FastifyInstrumentation(),
      new PgInstrumentation({
        enhancedDatabaseReporting: true,
      }),
      new IORedisInstrumentation(),
    ],
  });

  sdk.start();

  // Graceful shutdown: flush pending spans on process exit
  const shutdown = async () => {
    if (sdk) {
      try {
        await sdk.shutdown();
      } catch (err) {
        console.error('Error shutting down OpenTelemetry SDK', err);
      }
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

/**
 * Shut down the tracing SDK manually (e.g. in tests or cleanup).
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = undefined;
  }
}
