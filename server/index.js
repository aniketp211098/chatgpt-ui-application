import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logs, services, spans } from './data.js';

const port = Number(process.env.PORT || 4000);
const rootDir = join(fileURLToPath(new URL('..', import.meta.url)), 'public');

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function buildTrace(traceId) {
  const traceSpans = spans.filter((span) => span.traceId === traceId).sort((a, b) => a.startMs - b.startMs);
  const byId = new Map(traceSpans.map((span) => [span.spanId, { ...span, children: [] }]));
  const roots = [];

  for (const span of byId.values()) {
    if (span.parentSpanId && byId.has(span.parentSpanId)) {
      byId.get(span.parentSpanId).children.push(span);
    } else {
      roots.push(span);
    }
  }

  return { traceId, roots, spans: traceSpans };
}

function traceSummaries() {
  const traceIds = [...new Set(spans.map((span) => span.traceId))];
  return traceIds.map((traceId) => {
    const traceSpans = spans.filter((span) => span.traceId === traceId);
    const start = Math.min(...traceSpans.map((span) => span.startMs));
    const end = Math.max(...traceSpans.map((span) => span.startMs + span.durationMs));
    return {
      traceId,
      startMs: start,
      durationMs: end - start,
      services: [...new Set(traceSpans.map((span) => span.serviceName))],
      statusCode: traceSpans.some((span) => span.statusCode === 'ERROR') ? 'ERROR' : 'OK',
      errorCount: traceSpans.filter((span) => span.statusCode === 'ERROR').length,
    };
  });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const safePath = normalize(requested).replace(/^\/+/, '');
  const filePath = join(rootDir, safePath);
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
  };

  try {
    const contents = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream' });
    res.end(contents);
  } catch {
    const fallback = await readFile(join(rootDir, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fallback);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (url.pathname === '/api/health') return json(res, 200, { ok: true, service: 'custom-observability-console' });
  if (url.pathname === '/api/services/discover') return json(res, 200, { refreshedAt: new Date().toISOString(), services });
  if (url.pathname === '/api/traces') return json(res, 200, { traces: traceSummaries() });

  const traceMatch = url.pathname.match(/^\/api\/traces\/([^/]+)$/);
  if (traceMatch) {
    const trace = buildTrace(traceMatch[1]);
    return trace.spans.length ? json(res, 200, trace) : json(res, 404, { error: 'trace not found' });
  }

  const logMatch = url.pathname.match(/^\/api\/traces\/([^/]+)\/logs$/);
  if (logMatch) {
    return json(res, 200, { logs: logs.filter((log) => log.traceId === logMatch[1]).sort((a, b) => a.timestamp - b.timestamp) });
  }

  if (url.pathname === '/api/test/execute' && req.method === 'POST') {
    const { serviceId, method = 'GET', path = '/', body } = await readBody(req);
    const service = services.find((candidate) => candidate.id === serviceId) || services[0];
    const syntheticTraceId = `demo${Math.random().toString(16).slice(2).padEnd(28, '0').slice(0, 28)}`;
    const failed = service.id === 'payment-api';
    return json(res, failed ? 502 : 200, {
      request: {
        method,
        target: `${service.endpoint}${path}`,
        routedVia: 'internal Kubernetes DNS',
        body: body || null,
      },
      response: failed
        ? { ok: false, error: 'PaymentGatewayTimeout', message: 'Synthetic payment-api failure for correlation demo' }
        : { ok: true, service: service.name, namespace: service.namespace, receivedAt: new Date().toISOString() },
      observability: {
        traceId: syntheticTraceId,
        traceparent: `00-${syntheticTraceId}-0123456789abcdef-01`,
      },
    });
  }

  return serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`Observability console running at http://localhost:${port}`);
});
