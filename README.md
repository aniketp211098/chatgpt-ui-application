# Custom Observability Console + API Tester

A dependency-free Node.js MVP for a custom EKS observability console. It demonstrates:

- ALB/Kubernetes-style service discovery results.
- Distributed trace reconstruction using `traceId`, `spanId`, and `parentSpanId`.
- A waterfall trace view with error highlighting.
- Trace-correlated logs.
- A microservice API tester that returns a synthetic `traceparent` header and response payload.

## Prerequisites

- Node.js 18 or newer. Node.js 20+ is recommended.
- Git.

No external npm packages are required for this MVP. The app uses Node's built-in HTTP server and browser-native HTML, CSS, and JavaScript.

## Run locally

From the repository root, run:

```bash
npm start
```

or:

```bash
npm run dev
```

Then open:

```text
http://localhost:4000
```

## Validate

In a second terminal, run:

```bash
npm run build
curl -s http://localhost:4000/api/health
curl -s http://localhost:4000/api/traces
```

`npm run build` runs `node server/check.js`, which verifies that demo services, parent-child span correlation, and trace-correlated logs are present.

## If you see `Could not read package.json`

That error means npm is being run in a folder that does not contain this repository's `package.json`, or your local checkout does not include the branch/commit that added the application files.

Check your current folder:

```bash
pwd
ls
```

You should see at least these files/folders:

```text
package.json
server/
public/
README.md
```

If `package.json` is missing, fetch and switch to the branch that contains this app. For example, if the branch is named `work`:

```bash
git fetch --all
git checkout work
```

Then confirm the file exists:

```bash
ls package.json
cat package.json
```

After that, run:

```bash
npm start
```

### Windows Git Bash example

```bash
cd /d/Aniket/Handson/chatgpt-ui-application
ls package.json
npm start
```

If `ls package.json` prints `No such file or directory`, you are either in the wrong folder or the app branch has not been checked out locally yet.

## Notes

This repository intentionally avoids third-party npm packages so the app can run in restricted environments where package registry access is blocked. Because there are no dependencies, `npm install` is optional and not required before `npm start`.
