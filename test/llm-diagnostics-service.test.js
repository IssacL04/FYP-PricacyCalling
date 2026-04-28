const test = require('node:test');
const assert = require('node:assert/strict');
const {
  LlmDiagnosticsService,
  normalizeDiagnosis,
  parseJsonObject,
  sanitizeForModel
} = require('../src/services/llm-diagnostics-service');

test('sanitizeForModel redacts sensitive values and message bodies', () => {
  const sanitized = sanitizeForModel({
    token: 'abc.def.ghi',
    apiKey: 'super-secret',
    line: 'x-api-key: secret-value +8613900000001',
    message: {
      body: 'private content'
    }
  });

  assert.equal(sanitized.apiKey, '[REDACTED]');
  assert.equal(sanitized.message.body, '[message-body-redacted]');
  assert.match(sanitized.line, /\[REDACTED\]/);
  assert.match(sanitized.line, /\+861\*\*\*\*0001/);
});

test('parseJsonObject accepts fenced JSON response', () => {
  const parsed = parseJsonObject('```json\n{"overall_status":"healthy"}\n```');
  assert.equal(parsed.overall_status, 'healthy');
});

test('normalizeDiagnosis adds safe fallback commands when problem signals exist', () => {
  const normalized = normalizeDiagnosis(
    {
      overall_status: 'critical',
      confidence: 'high',
      summary: '有错误',
      recommended_shell_commands: []
    },
    {
      precheck: {
        overall_status: 'critical'
      },
      overview: {
        capabilities: {
          managed_services: ['asterisk', 'privacy-calling-api']
        }
      },
      logs: {
        entries: [
          {
            level: 'error',
            message: 'boom'
          }
        ]
      }
    }
  );

  assert.equal(normalized.overall_status, 'critical');
  assert.ok(normalized.recommended_shell_commands.length >= 3);
  assert.ok(normalized.recommended_shell_commands.every((item) => item.safe_to_run));
});

test('LlmDiagnosticsService calls OpenAI-compatible chat completions endpoint', async () => {
  let calledUrl = '';
  let requestBody = null;
  const service = new LlmDiagnosticsService({
    apiKey: 'test-key',
    baseUrl: 'https://llm.example/v1/',
    model: 'ops-model',
    fetchFn: async (url, options) => {
      calledUrl = url;
      requestBody = JSON.parse(options.body);
      assert.equal(options.headers.authorization, 'Bearer test-key');
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    overall_status: 'healthy',
                    confidence: 'high',
                    summary: '系统健康',
                    key_findings: [],
                    suspected_causes: [],
                    recommended_shell_commands: [],
                    next_steps: []
                  })
                }
              }
            ],
            usage: {
              total_tokens: 123
            }
          });
        }
      };
    }
  });

  const result = await service.analyze({
    precheck: {
      overall_status: 'healthy'
    },
    logs: {
      entries: []
    }
  });

  assert.equal(calledUrl, 'https://llm.example/v1/chat/completions');
  assert.equal(requestBody.model, 'ops-model');
  assert.equal(result.diagnosis.summary, '系统健康');
  assert.equal(result.usage.total_tokens, 123);
});
