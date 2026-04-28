const { AppError } = require('../utils/errors');

const DIAGNOSIS_STATUS = new Set(['healthy', 'degraded', 'critical', 'unknown']);
const CONFIDENCE_LEVELS = new Set(['low', 'medium', 'high']);
const FINDING_LEVELS = new Set(['info', 'warning', 'error']);
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_TOKENS = 1600;

const SYSTEM_PROMPT = `
你是 Privacy Calling 项目的资深 SRE。该系统由 Node.js/Express API、Asterisk SIP/RTP、AMI、SQLite、systemd 服务和运维 Dashboard 组成。
你会收到一份已经脱敏和裁剪过的运行快照，其中包含健康检查、服务状态、数据库统计、告警、近期通话/消息、系统日志和审计事件。

请只返回一个 JSON 对象，不要返回 Markdown，不要包裹代码块。JSON schema:
{
  "overall_status": "healthy|degraded|critical|unknown",
  "confidence": "low|medium|high",
  "summary": "中文概述，说明整体服务状态和主要依据",
  "key_findings": [
    {
      "level": "info|warning|error",
      "title": "发现标题",
      "detail": "具体说明",
      "evidence": "来自快照的证据"
    }
  ],
  "suspected_causes": ["可能原因，按优先级排序"],
  "recommended_shell_commands": [
    {
      "command": "服务器 shell 中可输入的排查命令",
      "purpose": "为什么运行这个命令",
      "requires_sudo": true,
      "safe_to_run": true
    }
  ],
  "next_steps": ["建议下一步"]
}

规则:
1. 全部内容使用中文。
2. 必须基于快照证据判断，不确定时说明 unknown/低置信度。
3. 排查命令优先使用只读命令，例如 systemctl status、journalctl、asterisk -rx、ss、df、free、sqlite3 SELECT。
4. 不要建议 rm、truncate、dd、mkfs、git reset、reboot、shutdown、kill、stop、restart、disable 等会改变系统状态的命令作为排查命令；如果必须提到修复动作，放到 next_steps，不放到 recommended_shell_commands。
5. 如果发现 warning/error、服务非 active、AMI/DB 异常或日志报错，recommended_shell_commands 至少给出 3 条具体命令。
`;

function normalizeBaseUrl(baseUrl) {
  const value = String(baseUrl || '').trim();
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function limitString(value, maxLength = 1200) {
  const text = String(value || '');
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}... [truncated ${text.length - maxLength} chars]`;
}

function maskPhoneNumber(match) {
  if (match.length <= 7) {
    return '[phone:redacted]';
  }
  return `${match.slice(0, 4)}****${match.slice(-4)}`;
}

function redactSensitiveText(value) {
  return limitString(value)
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_JWT]')
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s"',;]+/gi, '$1[REDACTED]')
    .replace(/(x-api-key\s*[:=]\s*)[^\s"',;]+/gi, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|secret|password|token)\s*[:=]\s*)[^\s"',;]+/gi, '$1[REDACTED]')
    .replace(/\+\d{8,15}\b/g, maskPhoneNumber);
}

function sanitizeForModel(value, depth = 0) {
  if (value === null || value === undefined) {
    return value;
  }

  if (depth > 8) {
    return '[max-depth]';
  }

  if (typeof value === 'string') {
    return redactSensitiveText(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 200).map((item) => sanitizeForModel(item, depth + 1));
  }

  if (typeof value === 'object') {
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      if (/^(api[_-]?key|secret|password|token|access_token|refresh_token)$/i.test(key)) {
        output[key] = '[REDACTED]';
        continue;
      }
      if (key === 'body' && typeof child === 'string') {
        output[key] = '[message-body-redacted]';
        continue;
      }
      output[key] = sanitizeForModel(child, depth + 1);
    }
    return output;
  }

  return String(value);
}

function extractTextContent(messageContent) {
  if (typeof messageContent === 'string') {
    return messageContent;
  }

  if (Array.isArray(messageContent)) {
    return messageContent
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item.text === 'string') {
          return item.text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return '';
}

function parseJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    throw new Error('empty model response');
  }

  const withoutFence = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch (error) {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(withoutFence.slice(start, end + 1));
    }
    throw error;
  }
}

function normalizeStringArray(value, fallback = []) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 12);
}

function isUnsafeCommand(command) {
  const text = String(command || '').trim().toLowerCase();
  return [
    /\brm\s+-/,
    /\btruncate\b/,
    /\bdd\s+/,
    /\bmkfs\b/,
    /\bgit\s+reset\b/,
    /\breboot\b/,
    /\bshutdown\b/,
    /\bsystemctl\s+(?:stop|restart|disable|enable|mask|unmask)\b/,
    /\bkill(?:all)?\b/,
    /\bpkill\b/
  ].some((pattern) => pattern.test(text));
}

function normalizeCommands(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const command = String(item.command || '').trim();
      if (!command) {
        return null;
      }

      const unsafe = isUnsafeCommand(command);
      return {
        command: limitString(command, 420),
        purpose: limitString(item.purpose || '排查相关状态', 300),
        requires_sudo: Boolean(item.requires_sudo || /^\s*sudo\b/.test(command)),
        safe_to_run: unsafe ? false : item.safe_to_run !== false
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeFindings(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const level = FINDING_LEVELS.has(item.level) ? item.level : 'info';
      const title = String(item.title || '').trim();
      const detail = String(item.detail || '').trim();
      if (!title && !detail) {
        return null;
      }
      return {
        level,
        title: limitString(title || level, 160),
        detail: limitString(detail, 700),
        evidence: limitString(item.evidence || '', 500)
      };
    })
    .filter(Boolean)
    .slice(0, 12);
}

function hasProblemSignal(snapshot) {
  const precheck = snapshot && snapshot.precheck;
  if (precheck && precheck.overall_status && precheck.overall_status !== 'healthy') {
    return true;
  }

  const logs = snapshot && snapshot.logs && Array.isArray(snapshot.logs.entries)
    ? snapshot.logs.entries
    : [];
  return logs.some((entry) => ['warning', 'error'].includes(entry.level));
}

function fallbackCommands(snapshot) {
  const services = snapshot
    && snapshot.overview
    && snapshot.overview.capabilities
    && Array.isArray(snapshot.overview.capabilities.managed_services)
    ? snapshot.overview.capabilities.managed_services
    : ['asterisk', 'privacy-calling-api'];
  const serviceNames = services.length > 0 ? services.join(' ') : 'asterisk privacy-calling-api';

  return [
    {
      command: `systemctl status ${serviceNames} --no-pager`,
      purpose: '查看受管服务是否 active、主进程 PID 和最近 systemd 状态',
      requires_sudo: false,
      safe_to_run: true
    },
    {
      command: `journalctl ${services.map((service) => `-u ${service}`).join(' ')} --since '15 minutes ago' --no-pager`,
      purpose: '查看最近 15 分钟服务日志中的错误和异常堆栈',
      requires_sudo: false,
      safe_to_run: true
    },
    {
      command: "sudo asterisk -rx 'core show channels concise'",
      purpose: '查看 Asterisk 当前通道数量和通话状态，判断是否有卡住的呼叫',
      requires_sudo: true,
      safe_to_run: true
    },
    {
      command: "sudo asterisk -rx 'pjsip show endpoints'",
      purpose: '确认 SIP endpoint 注册/可用状态，排查呼叫或消息投递失败',
      requires_sudo: true,
      safe_to_run: true
    }
  ];
}

function normalizeDiagnosis(value, snapshot, rawText = '') {
  const source = value && typeof value === 'object' ? value : {};
  const overallStatus = DIAGNOSIS_STATUS.has(source.overall_status)
    ? source.overall_status
    : (snapshot && snapshot.precheck && snapshot.precheck.overall_status) || 'unknown';
  const confidence = CONFIDENCE_LEVELS.has(source.confidence) ? source.confidence : 'medium';

  const diagnosis = {
    overall_status: overallStatus,
    confidence,
    summary: limitString(
      source.summary || rawText || '模型未返回结构化摘要，请查看原始响应。',
      900
    ),
    key_findings: normalizeFindings(source.key_findings),
    suspected_causes: normalizeStringArray(source.suspected_causes),
    recommended_shell_commands: normalizeCommands(source.recommended_shell_commands),
    next_steps: normalizeStringArray(source.next_steps)
  };

  if (hasProblemSignal(snapshot) && diagnosis.recommended_shell_commands.length < 3) {
    const existing = new Set(diagnosis.recommended_shell_commands.map((item) => item.command));
    for (const command of fallbackCommands(snapshot)) {
      if (!existing.has(command.command)) {
        diagnosis.recommended_shell_commands.push(command);
      }
      if (diagnosis.recommended_shell_commands.length >= 4) {
        break;
      }
    }
  }

  return diagnosis;
}

class LlmDiagnosticsService {
  constructor({
    enabled = true,
    provider = 'openai-compatible',
    apiKey = '',
    baseUrl = 'https://api.openai.com/v1',
    model = '',
    timeoutMs = DEFAULT_TIMEOUT_MS,
    temperature = 0.2,
    maxTokens = DEFAULT_MAX_TOKENS,
    fetchFn
  } = {}) {
    this.enabled = enabled !== false;
    this.provider = provider || 'openai-compatible';
    this.apiKey = String(apiKey || '').trim();
    this.baseUrl = normalizeBaseUrl(baseUrl || 'https://api.openai.com/v1');
    this.model = String(model || '').trim();
    this.timeoutMs = Math.max(1000, Number.parseInt(timeoutMs, 10) || DEFAULT_TIMEOUT_MS);
    this.temperature = Number.isFinite(Number(temperature)) ? Number(temperature) : 0.2;
    this.maxTokens = Math.max(256, Number.parseInt(maxTokens, 10) || DEFAULT_MAX_TOKENS);
    this.fetchFn = fetchFn || globalThis.fetch;
  }

  isConfigured() {
    return Boolean(this.enabled && this.apiKey && this.baseUrl && this.model && this.fetchFn);
  }

  getPublicConfig() {
    return {
      enabled: this.enabled,
      configured: this.isConfigured(),
      provider: this.provider,
      model: this.model || '',
      timeout_ms: this.timeoutMs
    };
  }

  async analyze(snapshot) {
    if (!this.enabled) {
      throw new AppError('AI diagnostics are disabled', 503, 'llm_diagnostics_disabled');
    }

    if (!this.isConfigured()) {
      throw new AppError(
        'AI diagnostics require LLM_API_KEY and LLM_MODEL',
        503,
        'llm_diagnostics_not_configured'
      );
    }

    const sanitizedSnapshot = sanitizeForModel(snapshot);
    const requestPayload = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT.trim()
        },
        {
          role: 'user',
          content: JSON.stringify(sanitizedSnapshot, null, 2)
        }
      ],
      temperature: this.temperature,
      max_tokens: this.maxTokens
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;

    try {
      response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal
      });
    } catch (error) {
      const message = error && error.name === 'AbortError'
        ? 'AI diagnostics request timed out'
        : `AI diagnostics request failed: ${error.message}`;
      throw new AppError(message, 502, 'llm_diagnostics_failed');
    } finally {
      clearTimeout(timeout);
    }

    const responseText = await response.text();
    if (!response.ok) {
      throw new AppError(
        `AI diagnostics API returned ${response.status}: ${limitString(responseText, 500)}`,
        502,
        'llm_diagnostics_failed',
        {
          status: response.status
        }
      );
    }

    let payload;
    try {
      payload = JSON.parse(responseText);
    } catch (error) {
      throw new AppError('AI diagnostics API returned invalid JSON', 502, 'llm_diagnostics_failed');
    }

    const content = extractTextContent(
      payload
        && payload.choices
        && payload.choices[0]
        && payload.choices[0].message
        && payload.choices[0].message.content
    );

    let parsedDiagnosis = null;
    try {
      parsedDiagnosis = parseJsonObject(content);
    } catch (error) {
      parsedDiagnosis = null;
    }

    return {
      generated_at: new Date().toISOString(),
      analyzer: this.getPublicConfig(),
      diagnosis: normalizeDiagnosis(parsedDiagnosis, sanitizedSnapshot, content),
      usage: payload.usage || null,
      raw_response_parseable: Boolean(parsedDiagnosis)
    };
  }
}

module.exports = {
  LlmDiagnosticsService,
  sanitizeForModel,
  normalizeDiagnosis,
  parseJsonObject
};
