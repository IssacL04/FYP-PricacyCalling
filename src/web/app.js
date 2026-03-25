const state = {
  apiKey: '',
  refreshing: false,
  actionInFlight: new Set(),
  overview: null,
  timer: null
};

const els = {
  apiKeyForm: document.getElementById('apiKeyForm'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  statusText: document.getElementById('statusText'),
  refreshBtn: document.getElementById('refreshBtn'),
  connectionBadge: document.getElementById('connectionBadge'),
  hostValue: document.getElementById('hostValue'),
  uptimeValue: document.getElementById('uptimeValue'),
  dbValue: document.getElementById('dbValue'),
  amiValue: document.getElementById('amiValue'),
  rssValue: document.getElementById('rssValue'),
  heapValue: document.getElementById('heapValue'),
  servicesGrid: document.getElementById('servicesGrid'),
  statsGrid: document.getElementById('statsGrid'),
  recentCallsBody: document.getElementById('recentCallsBody'),
  toast: document.getElementById('toast')
};

function showToast(text) {
  els.toast.textContent = text;
  els.toast.classList.add('show');
  window.setTimeout(() => els.toast.classList.remove('show'), 2400);
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

function request(path, { method = 'GET', body } = {}) {
  if (!state.apiKey) {
    return Promise.reject(new Error('请先填写 API Key'));
  }

  const headers = {
    'x-api-key': state.apiKey
  };
  if (body) {
    headers['content-type'] = 'application/json';
  }

  return fetch(path, {
    method,
    headers,
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

function renderOverview(data) {
  state.overview = data;
  els.hostValue.textContent = data.host || '-';
  els.uptimeValue.textContent = formatUptime(data.uptime_sec);
  els.dbValue.textContent = data.health && data.health.db === 'ok' ? 'OK' : 'ERROR';

  const ami = data.health && data.health.ami
    ? `${data.health.ami.connected ? 'connected' : 'disconnected'} / ${data.health.ami.authenticated ? 'auth' : 'no-auth'}`
    : '-';
  els.amiValue.textContent = ami;
  els.rssValue.textContent = `RSS ${data.memory ? data.memory.rss_mb : '-'} MB`;
  els.heapValue.textContent = `Heap ${data.memory ? data.memory.heap_used_mb : '-'} / ${data.memory ? data.memory.heap_total_mb : '-'} MB`;

  renderServices(data.services || [], data.capabilities || {});
  renderStats(data.database || {});
  renderRecentCalls(data.recent_calls || []);
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
  const users = database.users || {};
  const virtuals = database.virtual_numbers || {};
  const items = [
    ['总通话', calls.total],
    ['活跃通话', calls.active],
    ['24h 通话', calls.last_24h],
    ['24h 失败', calls.failed_last_24h],
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

async function refreshOverview() {
  if (state.refreshing) {
    return;
  }

  state.refreshing = true;
  els.refreshBtn.disabled = true;
  els.statusText.textContent = '同步中...';

  try {
    const data = await request('/v1/ops/overview');
    renderOverview(data);
    els.statusText.textContent = `已同步：${new Date().toLocaleTimeString()}`;
    setBadge(els.connectionBadge, '在线', 'ok');
  } catch (error) {
    els.statusText.textContent = error.message;
    setBadge(els.connectionBadge, '连接失败', 'err');
  } finally {
    state.refreshing = false;
    els.refreshBtn.disabled = false;
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
    await refreshOverview();
  } catch (error) {
    showToast(`操作失败: ${error.message}`);
  } finally {
    state.actionInFlight.delete(actionKey);
    renderServices((state.overview && state.overview.services) || [], (state.overview && state.overview.capabilities) || {});
  }
}

function startAutoRefresh() {
  if (state.timer) {
    window.clearInterval(state.timer);
  }
  state.timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      refreshOverview();
    }
  }, 15000);
}

function init() {
  state.apiKey = window.localStorage.getItem('privacy_calling_api_key') || '';
  els.apiKeyInput.value = state.apiKey;

  els.apiKeyForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const nextKey = els.apiKeyInput.value.trim();
    state.apiKey = nextKey;
    window.localStorage.setItem('privacy_calling_api_key', nextKey);
    refreshOverview();
  });

  els.refreshBtn.addEventListener('click', refreshOverview);
  startAutoRefresh();

  if (state.apiKey) {
    refreshOverview();
  } else {
    setBadge(els.connectionBadge, '待鉴权', 'warn');
    els.statusText.textContent = '请先输入 API Key。';
  }
}

init();
