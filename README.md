# Custom Observability Console + API Tester

A dependency-free Node.js MVP for a custom EKS observability console. It demonstrates:

- ALB/Kubernetes-style service discovery results.
- Distributed trace reconstruction using `traceId`, `spanId`, and `parentSpanId`.
- A waterfall trace view with error highlighting.
- Trace-correlated logs.
- A microservice API tester that returns a synthetic `traceparent` header and response payload.

## Run locally

```bash
npm start
```

Open <http://localhost:4000>.

## Validate

```bash
npm run build
curl -s http://localhost:4000/api/health
curl -s http://localhost:4000/api/traces
```

## Notes

This repository intentionally avoids third-party npm packages so the app can run in restricted environments where package registry access is blocked. The backend uses Node's built-in HTTP server and the frontend uses browser-native JavaScript, HTML, and CSS.
