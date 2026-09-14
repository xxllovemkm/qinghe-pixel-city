'use client';

import { useEffect, useRef, useState } from 'react';

type ModelConfig = {
  config: { base_url: string; model: string; send_thinking_field?: boolean };
  key_configured: boolean;
  judge_synced: boolean;
};

export function TeachingApiSettings({
  api,
  running,
  onSaved,
  onClose,
}: {
  api: string;
  running: boolean;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState('http://litellm-cn.woa.com/v1');
  const [model, setModel] = useState('deepseek-v4-pro');
  const [key, setKey] = useState('');
  const [configured, setConfigured] = useState(false);
  const [syncJudge, setSyncJudge] = useState(true);
  const [busy, setBusy] = useState<'loading' | 'save' | 'test' | null>(
    'loading',
  );
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    fetch(`${api}/api/school-day/model-config`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('无法读取 API 设置。');
        const data = (await response.json()) as ModelConfig;
        setUrl(data.config.base_url);
        setModel(data.config.model);
        setConfigured(data.key_configured);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setFailed(true);
          setMessage(error.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(null);
      });
    return () => {
      request.current?.abort();
    };
  }, [api]);

  async function submit(action: 'save' | 'test') {
    if (busy) return;
    setBusy(action);
    setMessage('');
    setFailed(false);
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch(`${api}/api/school-day/model-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          action,
          request_id: crypto.randomUUID(),
          base_url: url.trim(),
          model: model.trim(),
          ...(key.trim() ? { api_key: key.trim() } : {}),
          sync_judge: syncJudge,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        ok?: boolean;
        model?: string;
        latency_ms?: number;
        message?: string;
        key_configured: boolean;
      };
      if (!response.ok)
        throw new Error(
          typeof data.error === 'string' ? data.error : 'API 设置操作失败。',
        );
      if (action === 'test') {
        setFailed(!data.ok);
        setMessage(
          data.ok
            ? `连接成功 · ${data.model} · ${Math.round(data.latency_ms ?? 0)} ms · 已完成一次真实生成。`
            : (data.message ?? '模型测试未通过。'),
        );
      } else {
        setConfigured(data.key_configured);
        setKey('');
        onSaved();
        setMessage('配置已保存，将用于下一次开始或继续。');
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setFailed(true);
        setMessage(error instanceof Error ? error.message : '请求未完成。');
      }
    } finally {
      if (!controller.signal.aborted) setBusy(null);
    }
  }

  return (
    <section className="teaching-api-settings">
      <div className="api-settings-heading">
        <div>
          <h2>模型 API</h2>
          <p>配置模拟与评测使用的模型服务</p>
        </div>
        <button onClick={onClose} aria-label="关闭 API 设置">
          ×
        </button>
      </div>
      <label>
        API URL
        <input
          type="url"
          aria-label="API URL"
          value={url}
          disabled={!!busy}
          onChange={(e) => setUrl(e.target.value)}
          spellCheck={false}
        />
      </label>
      <label>
        Model
        <input
          aria-label="Model"
          value={model}
          disabled={!!busy}
          onChange={(e) => setModel(e.target.value)}
          spellCheck={false}
        />
      </label>
      <label>
        API Key
        <input
          aria-label="API Key"
          type="password"
          autoComplete="new-password"
          value={key}
          disabled={!!busy}
          placeholder={configured ? '已配置；留空保留当前密钥' : '填写 API Key'}
          onChange={(e) => setKey(e.target.value)}
        />
      </label>
      <label className="api-settings-checkbox">
        <input
          type="checkbox"
          checked={syncJudge}
          disabled={!!busy}
          onChange={(e) => setSyncJudge(e.target.checked)}
        />
        评测使用相同 API 配置
      </label>
      <p>
        连接测试会向当前填写的服务发送一次简短生成请求。密钥保存在本机服务端。
      </p>
      {running && <p>模拟正在运行，暂停后可以保存配置。</p>}
      {message && (
        <output
          className={failed ? 'api-settings-failure' : 'api-settings-success'}
        >
          {message}
        </output>
      )}
      <div className="api-settings-actions">
        <button
          disabled={!!busy || !url.trim() || !model.trim()}
          onClick={() => submit('test')}
        >
          {busy === 'test' ? '正在测试…' : '测试连接'}
        </button>
        <button
          className="teaching-primary"
          disabled={!!busy || running || !url.trim() || !model.trim()}
          onClick={() => submit('save')}
        >
          {busy === 'save' ? '正在保存…' : '保存配置'}
        </button>
      </div>
    </section>
  );
}
