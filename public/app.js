const state = { services: [], traces: [], selectedTraceId: '', roots: [], logs: [] };
const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok && response.status !== 502) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function flatten(spans) {
  return spans.flatMap((span) => [span, ...flatten(span.children || [])]);
}

async function refreshAll() {
  const [serviceResult, traceResult] = await Promise.all([api('/api/services/discover'), api('/api/traces')]);
  state.services = serviceResult.services;
  state.traces = traceResult.traces;
  state.selectedTraceId = state.selectedTraceId || state.traces[0]?.traceId || '';
  renderServiceOptions();
  renderServices();
  renderTraceList();
  await loadTrace(state.selectedTraceId);
}

async function loadTrace(traceId) {
  if (!traceId) return;
  state.selectedTraceId = traceId;
  const [trace, logResult] = await Promise.all([api(`/api/traces/${traceId}`), api(`/api/traces/${traceId}/logs`)]);
  state.roots = trace.roots;
  state.logs = logResult.logs;
  renderTraceList();
  renderWaterfall();
  renderLogs();
}

function renderMetrics(spans, traceDuration) {
  $('service-count').textContent = state.services.length;
  $('trace-count').textContent = state.traces.length;
  $('failed-count').textContent = spans.filter((span) => span.statusCode === 'ERROR').length;
  $('duration').textContent = `${traceDuration}ms`;
  $('duration-scale').textContent = `${traceDuration}ms`;
}

function renderTraceList() {
  $('trace-list').innerHTML = state.traces.map((trace) => `
    <button class="trace-card ${trace.traceId === state.selectedTraceId ? 'active' : ''}" data-trace-id="${trace.traceId}">
      <span class="badge ${trace.statusCode === 'ERROR' ? 'danger' : 'ok'}">${trace.statusCode}</span>
      <strong>${trace.traceId.slice(0, 16)}…</strong>
      <small>${trace.services.join(' → ')}</small>
      <small>${trace.durationMs}ms · ${trace.errorCount} errors</small>
    </button>
  `).join('');

  document.querySelectorAll('[data-trace-id]').forEach((button) => {
    button.addEventListener('click', () => loadTrace(button.dataset.traceId));
  });
}

function renderWaterfall() {
  const spans = flatten(state.roots);
  const minStart = Math.min(...spans.map((span) => span.startMs), Date.now());
  const maxEnd = Math.max(...spans.map((span) => span.startMs + span.durationMs), minStart + 1);
  const traceDuration = Math.max(maxEnd - minStart, 1);

  renderMetrics(spans, traceDuration);
  $('spans').innerHTML = spans.map((span) => {
    const left = ((span.startMs - minStart) / traceDuration) * 100;
    const width = Math.max((span.durationMs / traceDuration) * 100, 4);
    return `
      <div class="span-row">
        <div class="span-label"><strong>${escapeHtml(span.serviceName)}</strong><small>${escapeHtml(span.name)}</small></div>
        <div class="bar-track"><div class="bar ${span.statusCode === 'ERROR' ? 'error' : 'ok'}" style="left:${left}%;width:${width}%">${span.durationMs}ms</div></div>
      </div>
    `;
  }).join('');

  $('span-details').innerHTML = spans.map((span) => `
    <article class="detail-card">
      <div class="detail-heading"><span class="badge ${span.statusCode === 'ERROR' ? 'danger' : 'ok'}">${span.httpStatusCode}</span><strong>${escapeHtml(span.serviceName)}</strong><code>${escapeHtml(span.spanId)}</code></div>
      <p>${escapeHtml(span.name)}</p>
      <pre>${escapeHtml(JSON.stringify(span.metadata, null, 2))}</pre>
    </article>
  `).join('');
}

function renderLogs() {
  const filter = $('log-filter').value.toLowerCase();
  const logs = state.logs.filter((log) => `${log.serviceName} ${log.severity} ${log.message}`.toLowerCase().includes(filter));
  $('logs').innerHTML = logs.map((log) => `
    <div class="log-line ${log.severity.toLowerCase()}">
      <span>${new Date(log.timestamp).toLocaleTimeString()}</span>
      <strong>${escapeHtml(log.serviceName)}</strong>
      <em>${escapeHtml(log.severity)}</em>
      <p>${escapeHtml(log.message)}</p>
    </div>
  `).join('');
}

function renderServiceOptions() {
  $('service-select').innerHTML = state.services.map((service) => `<option value="${service.id}">${service.name}:${service.port}</option>`).join('');
}

function renderServices() {
  $('services').innerHTML = state.services.map((service) => `
    <article>
      <div><strong>${escapeHtml(service.name)}</strong><span class="badge ${service.targetHealth === 'healthy' ? 'ok' : 'danger'}">${service.targetHealth}</span></div>
      <code>${escapeHtml(service.targetGroup)}</code>
      <p>${escapeHtml(service.endpoint)}</p>
      <small>${escapeHtml(service.source)} · methods: ${service.methods.join(', ')}</small>
    </article>
  `).join('');
}

async function executeRequest() {
  $('send').disabled = true;
  $('send').textContent = 'Running…';
  try {
    const method = $('method-select').value;
    const body = method === 'POST' ? JSON.parse($('request-body').value || '{}') : undefined;
    const result = await api('/api/test/execute', {
      method: 'POST',
      body: JSON.stringify({ serviceId: $('service-select').value, method, path: $('path-input').value, body }),
    });
    $('response-body').value = JSON.stringify(result, null, 2);
  } catch (error) {
    $('response-body').value = JSON.stringify({ error: error.message }, null, 2);
  } finally {
    $('send').disabled = false;
    $('send').textContent = '▶ Send';
  }
}

$('refresh').addEventListener('click', refreshAll);
$('send').addEventListener('click', executeRequest);
$('log-filter').addEventListener('input', renderLogs);
refreshAll();
