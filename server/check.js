import { logs, services, spans } from './data.js';

if (!services.length) throw new Error('Expected demo services');
if (!spans.some((span) => span.parentSpanId)) throw new Error('Expected parent-child span correlation');
if (!logs.some((log) => log.traceId === spans[0].traceId)) throw new Error('Expected trace-correlated logs');

console.log('Static application checks passed');
