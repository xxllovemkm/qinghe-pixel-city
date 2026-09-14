export const EDUCATION_API = (
  process.env.NEXT_PUBLIC_AI_CAMPUS_API ?? 'http://127.0.0.1:8768'
).replace(/\/$/, '');

export async function educationRequest<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${EDUCATION_API}/api/school-day${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers:
      body === undefined
        ? { Accept: 'application/json' }
        : { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal,
  });
  const payload = (await response.json().catch(() => {
    throw new Error('学习服务未返回有效数据，请检查服务连接。');
  })) as { error?: string | { message?: string }; message?: string };
  if (!response.ok)
    throw new Error(
      typeof payload.error === 'string'
        ? payload.error
        : payload.error?.message ||
            payload.message ||
            `请求失败 (${response.status})`,
    );
  return payload as T;
}
