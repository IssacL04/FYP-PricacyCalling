const MAX_HISTORY_POINTS = 300;
const POLL_INTERVAL_MS = 2000;

const state = {
  apiKey: '',
  bearerToken: '',
  authMode: 'none',
  blockchainSession: null,
  pollInFlight: false,
  actionInFlight: new Set(),
  overview: null,
  timer: null,
  history: [],
  logs: [],
  logsWarnings: [],
  logsQuery: null,
  logsTailEnabled: true,
  logsKeyword: '',
  availableLogServices: ['privacy-calling-api', 'asterisk', 'asterisk-full'],
  selectedLogServices: ['privacy-calling-api', 'asterisk', 'asterisk-full'],
  selectedLogLevels: ['debug', 'info', 'warning', 'error'],
  auditEvents: []
};

const els = {
  apiKeyForm: document.getElementById('apiKeyForm'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  demoLoginBtn: document.getElementById('demoLoginBtn'),
  authModeText: document.getElementById('authModeText'),
  nodeSessionPanel: document.getElementById('nodeSessionPanel'),
  nodeAddressValue: document.getElementById('nodeAddressValue'),
  nodeIdValue: document.getElementById('nodeIdValue'),
  nodeMethodValue: document.getElementById('nodeMethodValue'),
  nodeExpiresValue: document.getElementById('nodeExpiresValue'),
  statusText: document.getElementById('statusText'),
  refreshBtn: document.getElementById('refreshBtn'),
  connectionBadge: document.getElementById('connectionBadge'),
  hostValue: document.getElementById('hostValue'),
  uptimeValue: document.getElementById('uptimeValue'),
  dbValue: document.getElementById('dbValue'),
  amiValue: document.getElementById('amiValue'),
  rssValue: document.getElementById('rssValue'),
  heapValue: document.getElementById('heapValue'),
  loadValue: document.getElementById('loadValue'),
  alertsCount: document.getElementById('alertsCount'),
  alertsList: document.getElementById('alertsList'),
  chartMeta: document.getElementById('chartMeta'),
  lineLoad: document.getElementById('lineLoad'),
  lineHeap: document.getElementById('lineHeap'),
  lineCalls: document.getElementById('lineCalls'),
  legendLoad: document.getElementById('legendLoad'),
  legendHeap: document.getElementById('legendHeap'),
  legendCalls: document.getElementById('legendCalls'),
  servicesGrid: document.getElementById('servicesGrid'),
  statsGrid: document.getElementById('statsGrid'),
  recentCallsBody: document.getElementById('recentCallsBody'),
  recentMessagesBody: document.getElementById('recentMessagesBody'),
  logsMeta: document.getElementById('logsMeta'),
  logsServiceFilters: document.getElementById('logsServiceFilters'),
  logsLevelFilters: document.getElementById('logsLevelFilters'),
  logsKeywordInput: document.getElementById('logsKeywordInput'),
  logsTailBtn: document.getElementById('logsTailBtn'),
  logsManualBtn: document.getElementById('logsManualBtn'),
  logsExportBtn: document.getElementById('logsExportBtn'),
  logsWarnings: document.getElementById('logsWarnings'),
  logsBody: document.getElementById('logsBody'),
  auditList: document.getElementById('auditList'),
  toast: document.getElementById('toast')
};

function hasApiKeyAuth() {
  return Boolean(state.apiKey);
}

function hasBearerAuth() {
  return Boolean(state.bearerToken);
}

function hasAnyAuth() {
  return hasApiKeyAuth() || hasBearerAuth();
}

function setAuthMode(mode) {
  state.authMode = mode;
  window.localStorage.setItem('privacy_calling_auth_mode', mode);
  if (els.authModeText) {
    if (mode === 'demo_jwt') {
      els.authModeText.textContent = '当前鉴权：Demo JWT（免钱包）';
    } else if (mode === 'api_key') {
      els.authModeText.textContent = '当前鉴权：API Key';
    } else {
      els.authModeText.textContent = '当前鉴权：未连接';
    }
  }
  renderNodeSession();
}

function decodeBase64Url(input) {
  const normalized = String(input || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = pad === 0 ? normalized : `${normalized}${'='.repeat(4 - pad)}`;
  return atob(padded);
}

function tryDecodeJwtClaims(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) {
      return null;
    }
    const json = decodeBase64Url(parts[1]);
    const claims = JSON.parse(json);
    return claims && typeof claims === 'object' ? claims : null;
  } catch (error) {
    return null;
  }
}

function setBlockchainSession(session) {
  state.blockchainSession = session || null;
  if (state.blockchainSession) {
    window.localStorage.setItem(
      'privacy_calling_blockchain_session',
      JSON.stringify(state.blockchainSession)
    );
  } else {
    window.localStorage.removeItem('privacy_calling_blockchain_session');
  }
  renderNodeSession();
}

function clearBlockchainSession() {
  setBlockchainSession(null);
}

function renderNodeSession() {
  if (!els.nodeSessionPanel) {
    return;
  }

  const session = state.blockchainSession;
  if (!session || !hasBearerAuth()) {
    els.nodeSessionPanel.classList.remove('active');
    els.nodeAddressValue.textContent = '-';
    els.nodeIdValue.textContent = '-';
    els.nodeMethodValue.textContent = state.authMode === 'api_key' ? 'api_key' : '-';
    els.nodeExpiresValue.textContent = '-';
    return;
  }

  els.nodeSessionPanel.classList.add('active');
  els.nodeAddressValue.textContent = session.address || '-';
  els.nodeIdValue.textContent = session.nodeId || '-';
  els.nodeMethodValue.textContent = session.authMethod || '-';
  els.nodeExpiresValue.textContent = session.expiresAt ? formatTimestamp(session.expiresAt) : '-';
}

function showToast(text) {
  els.toast.textContent = text;
  els.toast.classList.add('show');
  window.setTimeout(() => els.toast.classList.remove('show'), 2600);
}

function setBadge(element, text, level) {
  element.textContent = text;
  element.classList.remove('ok', 'warn', 'err');
  element.classList.add(level);
}

function formatUptime(seconds) {
  const sec = Math.max(0, Number(seconds || 0));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) {
    return `${d}d ${h}h ${m}m`;
  }
  return `${h}h ${m}m`;
}

function formatPercent(value, digits = 1) {
  return `${(Number(value || 0) * 100).toFixed(digits)}%`;
}

function formatTimestamp(value) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString();
}

function publicRequest(path, { method = 'GET', body, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (body && !requestHeaders['content-type']) {
    requestHeaders['content-type'] = 'application/json';
  }

  return fetch(path, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined
  }).then(async (resp) => {
    const payload = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const message = (payload && payload.error && payload.error.message) || `请求失败(${resp.status})`;
      throw new Error(message);
    }
    return payload;
  });
}

function request(path, { method = 'GET', body } = {}) {
  if (!hasAnyAuth()) {
    return Promise.reject(new Error('请先使用 API Key 或 Demo 登录'));
  }

  const headers = {};
  if (state.authMode === 'demo_jwt' && hasBearerAuth()) {
    headers.authorization = `Bearer ${state.bearerToken}`;
  } else if (hasApiKeyAuth()) {
    headers['x-api-key'] = state.apiKey;
  } else if (hasBearerAuth()) {
    headers.authorization = `Bearer ${state.bearerToken}`;
  }

  if (body) {
    headers['content-type'] = 'application/json';
  }

  return publicRequest(path, { method, body, headers });
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value || 0)));
}

function toFixedSafe(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return '-';
  }
  return n.toFixed(digits);
}

function pushHistoryPoint(data) {
  const point = {
    ts: data.generated_at || new Date().toISOString(),
    load: data.metrics && Number.isFinite(Number(data.metrics.load_per_cpu_1m))
      ? Number(data.metrics.load_per_cpu_1m)
      : 0,
    heap: data.metrics && Number.isFinite(Number(data.metrics.heap_usage_ratio))
      ? Number(data.metrics.heap_usage_ratio)
      : 0,
    active: data.metrics && Number.isFinite(Number(data.metrics.active_calls))
      ? Number(data.metrics.active_calls)
      : 0
  };

  state.history.push(point);
  if (state.history.length > MAX_HISTORY_POINTS) {
    state.history.splice(0, state.history.length - MAX_HISTORY_POINTS);
  }
}

function buildPolylinePoints(values, normalizeFn) {
  if (!values.length) {
    return '';
  }

  const w = 760;
  const h = 220;
  const left = 20;
  const right = 740;
  const top = 20;
  const bottom = 200;
  const spanX = right - left;
  const spanY = bottom - top;

  if (values.length === 1) {
    const y = top + (1 - clamp01(normalizeFn(values[0], 0))) * spanY;
    return `${left},${y.toFixed(2)} ${right},${y.toFixed(2)}`;
  }

  return values
    .map((value, idx) => {
      const x = left + (idx / (values.length - 1)) * spanX;
      const y = top + (1 - clamp01(normalizeFn(value, idx))) * spanY;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function renderLoadChart() {
  const points = state.history;
  if (points.length === 0) {
    els.lineLoad.setAttribute('points', '');
    els.lineHeap.setAttribute('points', '');
    els.lineCalls.setAttribute('points', '');
    els.chartMeta.textContent = '0 samples';
    els.legendLoad.textContent = '-';
    els.legendHeap.textContent = '-';
    els.legendCalls.textContent = '-';
    return;
  }

  const latest = points[points.length - 1];
  const loadErrorThreshold = state.overview && state.overview.thresholds && state.overview.thresholds.load_per_cpu_1m
    ? Number(state.overview.thresholds.load_per_cpu_1m.error || 1.2)
    : 1.2;
  const activeErrorThreshold = state.overview && state.overview.thresholds && state.overview.thresholds.active_calls
    ? Number(state.overview.thresholds.active_calls.error || 50)
    : 50;

  const loadMax = Math.max(1.4, loadErrorThreshold * 1.25);
  const activeMax = Math.max(10, activeErrorThreshold * 1.25, ...points.map((p) => p.active));

  els.lineLoad.setAttribute(
    'points',
    buildPolylinePoints(points, (value) => value.load / loadMax)
  );
  els.lineHeap.setAttribute(
    'points',
    buildPolylinePoints(points, (value) => value.heap)
  );
  els.lineCalls.setAttribute(
    'points',
    buildPolylinePoints(points, (value) => value.active / activeMax)
  );

  els.chartMeta.textContent = `${points.length} samples / 10min window`;
  els.legendLoad.textContent = toFixedSafe(latest.load, 3);
  els.legendHeap.textContent = formatPercent(latest.heap, 1);
  els.legendCalls.textContent = String(Math.round(latest.active));
}

function renderAlerts(alerts) {
  const list = Array.isArray(alerts) ? alerts : [];
  els.alertsList.innerHTML = '';
  els.alertsCount.textContent = `${list.length} active`;

  if (list.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = '暂无告警，系统状态正常。';
    els.alertsList.appendChild(empty);
    return;
  }

  list.forEach((alert) => {
    const node = document.createElement('article');
    node.className = `alert-item ${alert.level === 'error' ? 'error' : 'warning'}`;

    const title = document.createElement('strong');
    title.textContent = alert.metric || alert.id || 'alert';

    const meta = document.createElement('p');
    meta.textContent = alert.message || '-';

    node.append(title, meta);
    els.alertsList.appendChild(node);
  });
}

function renderOverview(data) {
  state.overview = data;
  pushHistoryPoint(data);

  if (Array.isArray(data.capabilities && data.capabilities.log_services) && data.capabilities.log_services.length > 0) {
    state.availableLogServices = [...data.capabilities.log_services];

    const validSelections = state.selectedLogServices.filter((svc) => state.availableLogServices.includes(svc));
    state.selectedLogServices = validSelections.length > 0
      ? validSelections
      : [...state.availableLogServices];

    renderLogServiceFilters();
  }

  els.hostValue.textContent = data.host || '-';
  els.uptimeValue.textContent = formatUptime(data.uptime_sec);
  els.dbValue.textContent = data.health && data.health.db === 'ok' ? 'OK' : 'ERROR';

  const ami = data.health && data.health.ami
    ? `${data.health.ami.connected ? 'connected' : 'disconnected'} / ${data.health.ami.authenticated ? 'auth' : 'no-auth'}`
    : '-';
  els.amiValue.textContent = ami;

  els.rssValue.textContent = `RSS ${data.memory ? data.memory.rss_mb : '-'} MB`;
  els.heapValue.textContent = `Heap ${data.memory ? data.memory.heap_used_mb : '-'} / ${data.memory ? data.memory.heap_total_mb : '-'} MB`;
  els.loadValue.textContent = `Load(1m/Core) ${data.metrics ? toFixedSafe(data.metrics.load_per_cpu_1m, 3) : '-'}`;

  renderAlerts(data.alerts || []);
  renderLoadChart();
  renderServices(data.services || [], data.capabilities || {});
  renderStats(data.database || {});
  renderRecentCalls(data.recent_calls || []);
  renderRecentMessages(data.recent_messages || []);
}

function renderServices(services, capabilities) {
  els.servicesGrid.innerHTML = '';
  const canControl = Boolean(capabilities.allow_service_control);

  services.forEach((svc) => {
    const card = document.createElement('article');
    card.className = 'service-card';

    const head = document.createElement('div');
    head.className = 'service-head';

    const titleWrap = document.createElement('div');
    const title = document.createElement('h3');
    title.className = 'service-title';
    title.textContent = svc.id || 'unknown';

    const meta = document.createElement('p');
    meta.className = 'service-meta';
    meta.textContent = `${svc.load_state} / ${svc.unit_file_state}`;
    titleWrap.append(title, meta);

    const badge = document.createElement('span');
    badge.className = 'badge';
    if (svc.active_state === 'active') {
      setBadge(badge, `${svc.active_state}:${svc.sub_state}`, 'ok');
    } else if (svc.active_state === 'activating' || svc.active_state === 'deactivating') {
      setBadge(badge, `${svc.active_state}:${svc.sub_state}`, 'warn');
    } else {
      setBadge(badge, `${svc.active_state}:${svc.sub_state}`, 'err');
    }

    head.append(titleWrap, badge);

    const pid = document.createElement('p');
    pid.className = 'service-meta';
    pid.textContent = `PID: ${svc.main_pid || 0}  |  Since: ${svc.active_since || '-'}`;

    const actions = document.createElement('div');
    actions.className = 'service-actions';

    ['start', 'stop', 'restart'].forEach((action) => {
      const btn = document.createElement('button');
      btn.className = action === 'restart' ? 'btn tonal' : 'btn outline';
      btn.type = 'button';
      btn.textContent = action;
      const actionKey = `${svc.id}:${action}`;
      btn.disabled = !canControl || state.actionInFlight.has(actionKey);
      btn.addEventListener('click', () => handleServiceAction(svc.id, action));
      actions.appendChild(btn);
    });

    card.append(head, pid, actions);
    els.servicesGrid.appendChild(card);
  });
}

function renderStats(database) {
  const calls = database.calls || {};
  const messages = database.messages || {};
  const users = database.users || {};
  const virtuals = database.virtual_numbers || {};
  const messageTotal = Number(messages.total || 0);
  const messageFailed = Number(messages.failed || 0);
  const messageFailureRate = messageTotal > 0
    ? formatPercent(messageFailed / messageTotal, 1)
    : '0.0%';

  const items = [
    ['总通话', calls.total],
    ['活跃通话', calls.active],
    ['24h 通话', calls.last_24h],
    ['24h 失败', calls.failed_last_24h],
    ['总消息', messages.total || 0],
    ['消息失败率', messageFailureRate],
    ['用户(启用)', `${users.enabled || 0}/${users.total || 0}`],
    ['虚拟号(启用)', `${virtuals.enabled || 0}/${virtuals.total || 0}`]
  ];

  els.statsGrid.innerHTML = '';
  items.forEach(([label, value]) => {
    const node = document.createElement('article');
    node.className = 'stat-pill';

    const l = document.createElement('span');
    l.textContent = label;

    const v = document.createElement('strong');
    v.textContent = value ?? 0;

    node.append(l, v);
    els.statsGrid.appendChild(node);
  });
}

function renderRecentCalls(calls) {
  els.recentCallsBody.innerHTML = '';
  if (!calls.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.textContent = '暂无通话记录';
    row.appendChild(cell);
    els.recentCallsBody.appendChild(row);
    return;
  }

  calls.forEach((call) => {
    const row = document.createElement('tr');

    [
      call.call_id,
      `${call.status}${call.bridge_status ? ` (${call.bridge_status})` : ''}`,
      call.caller_user_id || '-',
      call.callee_e164 || '-',
      call.selected_virtual_id || '-',
      call.created_at || '-'
    ].forEach((value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    });

    els.recentCallsBody.appendChild(row);
  });
}

function renderRecentMessages(messages) {
  if (!els.recentMessagesBody) {
    return;
  }

  els.recentMessagesBody.innerHTML = '';
  if (!messages.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.textContent = '暂无消息记录';
    row.appendChild(cell);
    els.recentMessagesBody.appendChild(row);
    return;
  }

  messages.forEach((message) => {
    const row = document.createElement('tr');

    [
      message.message_id || '-',
      message.status || '-',
      message.sender_endpoint || message.sender_user_id || '-',
      message.target_endpoint || message.target_e164 || '-',
      message.selected_virtual_e164 || '-',
      message.created_at || '-'
    ].forEach((value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    });

    els.recentMessagesBody.appendChild(row);
  });
}

function createFilterChip(text, active, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `chip ${active ? 'active' : ''}`;
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}

function renderLogServiceFilters() {
  els.logsServiceFilters.innerHTML = '';
  state.availableLogServices.forEach((service) => {
    const active = state.selectedLogServices.includes(service);
    els.logsServiceFilters.appendChild(
      createFilterChip(service, active, () => toggleLogService(service))
    );
  });
}

function renderLogLevelFilters() {
  els.logsLevelFilters.innerHTML = '';
  ['debug', 'info', 'warning', 'error'].forEach((level) => {
    const active = state.selectedLogLevels.includes(level);
    els.logsLevelFilters.appendChild(
      createFilterChip(level, active, () => toggleLogLevel(level))
    );
  });
}

function ensureAtLeastOneSelected(current, fallbackList) {
  if (current.length > 0) {
    return current;
  }
  return [fallbackList[0]];
}

function toggleLogService(service) {
  const exists = state.selectedLogServices.includes(service);
  const next = exists
    ? state.selectedLogServices.filter((item) => item !== service)
    : [...state.selectedLogServices, service];

  state.selectedLogServices = ensureAtLeastOneSelected(next, state.availableLogServices);
  renderLogServiceFilters();
  refreshLogs({ manual: true });
  postAuditEvent('logs_filters_updated', 'dashboard.logs.services', {
    services: state.selectedLogServices
  });
}

function toggleLogLevel(level) {
  const exists = state.selectedLogLevels.includes(level);
  const next = exists
    ? state.selectedLogLevels.filter((item) => item !== level)
    : [...state.selectedLogLevels, level];

  state.selectedLogLevels = ensureAtLeastOneSelected(next, ['debug', 'info', 'warning', 'error']);
  renderLogLevelFilters();
  refreshLogs({ manual: true });
  postAuditEvent('logs_filters_updated', 'dashboard.logs.levels', {
    levels: state.selectedLogLevels
  });
}

function getFilteredLogsByKeyword() {
  const keyword = String(state.logsKeyword || '').trim().toLowerCase();
  if (!keyword) {
    return state.logs;
  }

  return state.logs.filter((entry) => {
    const haystack = `${entry.message || ''} ${entry.service || ''} ${entry.level || ''}`.toLowerCase();
    return haystack.includes(keyword);
  });
}

function renderLogs() {
  const list = getFilteredLogsByKeyword();
  els.logsBody.innerHTML = '';

  if (list.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = '暂无日志记录';
    row.appendChild(cell);
    els.logsBody.appendChild(row);
  } else {
    list.forEach((entry) => {
      const row = document.createElement('tr');
      row.className = `log-row ${entry.level || 'info'}`;

      const ts = document.createElement('td');
      ts.textContent = formatTimestamp(entry.timestamp);

      const svc = document.createElement('td');
      svc.textContent = entry.service || '-';

      const lvl = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `log-level ${entry.level || 'info'}`;
      badge.textContent = entry.level || 'info';
      lvl.appendChild(badge);

      const msg = document.createElement('td');
      msg.className = 'log-message';
      msg.textContent = entry.message || '';

      row.append(ts, svc, lvl, msg);
      els.logsBody.appendChild(row);
    });
  }

  els.logsWarnings.innerHTML = '';
  if (Array.isArray(state.logsWarnings) && state.logsWarnings.length > 0) {
    state.logsWarnings.forEach((warn) => {
      const node = document.createElement('p');
      node.textContent = `${warn.service}: ${warn.message}`;
      els.logsWarnings.appendChild(node);
    });
  }

  const selected = `${state.selectedLogServices.length} services / ${state.selectedLogLevels.length} levels`;
  const sinceSec = state.logsQuery && state.logsQuery.since_sec ? state.logsQuery.since_sec : '-';
  els.logsMeta.textContent = `${list.length} entries (${selected}, since ${sinceSec}s)`;
}

function safeDetailsPreview(details) {
  if (!details) {
    return '-';
  }
  const text = JSON.stringify(details);
  return text.length > 140 ? `${text.slice(0, 140)}...` : text;
}

function renderAuditEvents() {
  els.auditList.innerHTML = '';

  if (!state.auditEvents.length) {
    const item = document.createElement('li');
    item.className = 'audit-item';
    item.textContent = '暂无审计记录';
    els.auditList.appendChild(item);
    return;
  }

  state.auditEvents.forEach((event) => {
    const item = document.createElement('li');
    item.className = 'audit-item';

    const head = document.createElement('div');
    head.className = 'audit-head';

    const action = document.createElement('strong');
    action.textContent = `${event.action} @ ${event.target}`;

    const status = document.createElement('span');
    status.className = `badge ${event.result === 'failed' ? 'err' : event.result === 'success' ? 'ok' : 'warn'}`;
    status.textContent = event.result;

    head.append(action, status);

    const meta = document.createElement('p');
    meta.className = 'audit-meta';
    meta.textContent = `${formatTimestamp(event.created_at)} | actor=${event.actor} | ${safeDetailsPreview(event.details)}`;

    item.append(head, meta);
    els.auditList.appendChild(item);
  });
}

function buildLogsPath() {
  const params = new URLSearchParams();
  params.set('services', state.selectedLogServices.join(','));
  params.set('levels', state.selectedLogLevels.join(','));
  params.set('since_sec', '600');
  params.set('limit', '300');
  return `/v1/ops/logs?${params.toString()}`;
}

async function refreshOverview() {
  const data = await request('/v1/ops/overview');
  renderOverview(data);
  els.statusText.textContent = `已同步：${new Date().toLocaleTimeString()}`;
  setBadge(els.connectionBadge, '在线', 'ok');
}

async function refreshLogs({ manual = false } = {}) {
  if (!state.logsTailEnabled && !manual) {
    return;
  }

  const data = await request(buildLogsPath());
  state.logs = Array.isArray(data.entries) ? data.entries : [];
  state.logsWarnings = Array.isArray(data.warnings) ? data.warnings : [];
  state.logsQuery = data.query || null;
  renderLogs();

  if (manual) {
    showToast(`日志已刷新 (${state.logs.length} 条)`);
    postAuditEvent('logs_manual_refresh', 'dashboard.logs', {
      entries: state.logs.length,
      services: state.selectedLogServices,
      levels: state.selectedLogLevels
    });
  }
}

async function refreshAuditEvents() {
  const payload = await request('/v1/ops/audit-events?limit=40');
  state.auditEvents = Array.isArray(payload.events) ? payload.events : [];
  renderAuditEvents();
}

async function runRefreshCycle({ manual = false } = {}) {
  if (state.pollInFlight || !hasAnyAuth()) {
    return;
  }

  state.pollInFlight = true;
  els.refreshBtn.disabled = true;
  if (manual) {
    els.statusText.textContent = '同步中...';
  }

  try {
    await refreshOverview();
    await refreshLogs({ manual: false });
    await refreshAuditEvents();
  } catch (error) {
    setBadge(els.connectionBadge, '连接失败', 'err');
    els.statusText.textContent = error.message;
  } finally {
    state.pollInFlight = false;
    els.refreshBtn.disabled = false;
  }
}

async function postAuditEvent(action, target, details, result = 'success') {
  try {
    await request('/v1/ops/audit-events', {
      method: 'POST',
      body: {
        action,
        target,
        result,
        details
      }
    });
  } catch (error) {
    // do not disrupt dashboard behavior when audit write fails
  }
}

async function handleServiceAction(serviceName, action) {
  const actionKey = `${serviceName}:${action}`;
  state.actionInFlight.add(actionKey);
  renderServices((state.overview && state.overview.services) || [], (state.overview && state.overview.capabilities) || {});

  try {
    const payload = await request(`/v1/ops/services/${encodeURIComponent(serviceName)}/${encodeURIComponent(action)}`, {
      method: 'POST'
    });
    showToast(`${payload.service.id} 已执行 ${action}`);
    await runRefreshCycle({ manual: true });
  } catch (error) {
    showToast(`操作失败: ${error.message}`);
  } finally {
    state.actionInFlight.delete(actionKey);
    renderServices((state.overview && state.overview.services) || [], (state.overview && state.overview.capabilities) || {});
  }
}

function updateTailButton() {
  if (state.logsTailEnabled) {
    els.logsTailBtn.textContent = '暂停追尾';
    els.logsTailBtn.classList.remove('filled');
    els.logsTailBtn.classList.add('outline');
  } else {
    els.logsTailBtn.textContent = '恢复追尾';
    els.logsTailBtn.classList.remove('outline');
    els.logsTailBtn.classList.add('filled');
  }
}

function exportLogsToJson() {
  const entries = getFilteredLogsByKeyword();
  const payload = {
    exported_at: new Date().toISOString(),
    query: {
      services: state.selectedLogServices,
      levels: state.selectedLogLevels,
      keyword: state.logsKeyword,
      tail: state.logsTailEnabled
    },
    entries
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ops-logs-${Date.now()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  showToast(`已导出 ${entries.length} 条日志`);
  postAuditEvent('logs_export_json', 'dashboard.logs', {
    entries: entries.length,
    keyword: state.logsKeyword
  });
}

async function manualRefreshLogs() {
  try {
    await refreshLogs({ manual: true });
    await refreshAuditEvents();
  } catch (error) {
    showToast(`日志刷新失败: ${error.message}`);
  }
}

async function handleDemoLogin() {
  els.demoLoginBtn.disabled = true;
  els.statusText.textContent = 'Demo 登录中...';
  try {
    const payload = await publicRequest('/v1/auth/demo-login', {
      method: 'POST',
      body: {}
    });

    state.bearerToken = String(payload.access_token || '').trim();
    if (!state.bearerToken) {
      throw new Error('Demo 登录未返回 access_token');
    }

    window.localStorage.setItem('privacy_calling_bearer_token', state.bearerToken);
    const expiresSec = Number(payload.expires_in_sec);
    const now = Date.now();
    setBlockchainSession({
      address: payload.subject_address || '-',
      nodeId: payload.node_id || '-',
      authMethod: payload.auth_method || 'blockchain',
      issuedAt: new Date(now).toISOString(),
      expiresAt: Number.isFinite(expiresSec) ? new Date(now + expiresSec * 1000).toISOString() : null
    });
    setAuthMode('demo_jwt');
    els.statusText.textContent = 'Demo JWT 已就绪，开始同步...';
    setBadge(els.connectionBadge, 'Demo JWT', 'warn');
    showToast('Demo 登录成功（免钱包）');
    await runRefreshCycle({ manual: true });
  } catch (error) {
    els.statusText.textContent = `Demo 登录失败：${error.message}`;
    setBadge(els.connectionBadge, '连接失败', 'err');
    showToast(`Demo 登录失败: ${error.message}`);
  } finally {
    els.demoLoginBtn.disabled = false;
  }
}

function startAutoRefresh() {
  if (state.timer) {
    window.clearInterval(state.timer);
  }

  state.timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      runRefreshCycle({ manual: false });
    }
  }, POLL_INTERVAL_MS);
}

function init() {
  state.apiKey = window.localStorage.getItem('privacy_calling_api_key') || '';
  state.bearerToken = window.localStorage.getItem('privacy_calling_bearer_token') || '';
  const savedSession = window.localStorage.getItem('privacy_calling_blockchain_session');
  if (savedSession) {
    try {
      state.blockchainSession = JSON.parse(savedSession);
    } catch (error) {
      state.blockchainSession = null;
    }
  }
  els.apiKeyInput.value = state.apiKey;

  if (!state.blockchainSession && state.bearerToken) {
    const claims = tryDecodeJwtClaims(state.bearerToken);
    if (claims && claims.sub) {
      state.blockchainSession = {
        address: claims.sub,
        nodeId: claims.node_id || '-',
        authMethod: claims.auth_method || 'blockchain',
        issuedAt: claims.iat ? new Date(Number(claims.iat) * 1000).toISOString() : null,
        expiresAt: claims.exp ? new Date(Number(claims.exp) * 1000).toISOString() : null
      };
    }
  }

  const savedMode = window.localStorage.getItem('privacy_calling_auth_mode');
  if (savedMode === 'demo_jwt' && state.bearerToken) {
    setAuthMode('demo_jwt');
  } else if (state.apiKey) {
    setAuthMode('api_key');
  } else {
    setAuthMode('none');
  }
  renderNodeSession();

  renderLogServiceFilters();
  renderLogLevelFilters();
  updateTailButton();
  renderLogs();
  renderLoadChart();
  renderAuditEvents();

  els.apiKeyForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const nextKey = els.apiKeyInput.value.trim();
    state.apiKey = nextKey;
    window.localStorage.setItem('privacy_calling_api_key', nextKey);
    state.bearerToken = '';
    window.localStorage.removeItem('privacy_calling_bearer_token');
    clearBlockchainSession();
    if (state.apiKey) {
      setAuthMode('api_key');
    } else {
      setAuthMode('none');
    }
    runRefreshCycle({ manual: true });
  });

  if (els.demoLoginBtn) {
    els.demoLoginBtn.addEventListener('click', handleDemoLogin);
  }

  els.refreshBtn.addEventListener('click', () => runRefreshCycle({ manual: true }));

  els.logsKeywordInput.addEventListener('input', () => {
    state.logsKeyword = els.logsKeywordInput.value.trim();
    renderLogs();
  });

  els.logsTailBtn.addEventListener('click', async () => {
    state.logsTailEnabled = !state.logsTailEnabled;
    updateTailButton();

    if (state.logsTailEnabled) {
      await postAuditEvent('logs_tail_resumed', 'dashboard.logs', {
        services: state.selectedLogServices,
        levels: state.selectedLogLevels
      });
      manualRefreshLogs();
    } else {
      await postAuditEvent('logs_tail_paused', 'dashboard.logs', {
        services: state.selectedLogServices,
        levels: state.selectedLogLevels
      });
    }
  });

  els.logsManualBtn.addEventListener('click', manualRefreshLogs);
  els.logsExportBtn.addEventListener('click', exportLogsToJson);

  startAutoRefresh();

  if (hasAnyAuth()) {
    runRefreshCycle({ manual: true });
  } else {
    setBadge(els.connectionBadge, '待鉴权', 'warn');
    els.statusText.textContent = '请先输入 API Key 或点击 Demo 登录。';
  }
}

init();
