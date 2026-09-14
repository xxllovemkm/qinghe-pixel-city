'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { educationRequest } from '@/lib/education-api';
import type {
  KnowledgeGraphData,
  KnowledgeGraphNode,
} from '@/lib/world/knowledge3d';
import KnowledgeGraph3D from './knowledge-graph3d';

type GraphResponse = {
  graph: KnowledgeGraphData;
  items?: KnowledgeGraphNode[];
  coverage_label?: string;
  total: number;
  returned: number;
  truncated: boolean;
};

export default function PublicKnowledgeAtlas({
  focusKey,
  focusVersion = 0,
}: {
  focusKey?: string;
  focusVersion?: number;
}) {
  const [opened, setOpened] = useState(false);
  const [graph, setGraph] = useState<KnowledgeGraphData | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KnowledgeGraphNode[]>([]);
  const [error, setError] = useState('');
  const [coverage, setCoverage] = useState('');
  const [focusScroll, setFocusScroll] = useState(0);
  const atlas = useRef<HTMLDetailsElement>(null);
  const [page, setPage] = useState<{
    key: string;
    offset: number;
    total: number;
    returned: number;
    truncated: boolean;
  } | null>(null);
  const revision = useRef(0);
  const fetchGraph = useCallback(
    (params: Record<string, string>, signal?: AbortSignal) =>
      educationRequest<GraphResponse>(
        `/knowledge?${new URLSearchParams(params)}`,
        undefined,
        signal,
      ),
    [],
  );

  useEffect(() => {
    if (!opened || graph || focusKey) return;
    const controller = new AbortController();
    const seq = ++revision.current;
    void fetchGraph({ action: 'browse' }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted || seq !== revision.current) return;
        setGraph(data.graph);
        setCoverage(data.coverage_label ?? '');
        setError('');
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : '知识图谱读取失败',
          );
      });
    return () => controller.abort();
  }, [opened, graph, focusKey, fetchGraph]);

  useEffect(() => {
    if (!focusKey) return;
    const controller = new AbortController();
    const seq = ++revision.current;
    void fetchGraph(
      { action: 'subgraph', key: focusKey, offset: '0' },
      controller.signal,
    )
      .then((data) => {
        if (controller.signal.aborted || seq !== revision.current) return;
        setOpened(true);
        setGraph(data.graph);
        setError('');
        setCoverage(data.coverage_label ?? '');
        setPage({
          key: focusKey,
          offset: 0,
          total: data.total,
          returned: data.returned,
          truncated: data.truncated,
        });
        setFocusScroll((value) => value + 1);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : '知识路径读取失败',
          );
      });
    return () => controller.abort();
  }, [focusKey, focusVersion, fetchGraph]);

  useEffect(() => {
    if (!focusScroll) return;
    const frame = requestAnimationFrame(() =>
      atlas.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
    return () => cancelAnimationFrame(frame);
  }, [focusScroll]);

  useEffect(() => {
    if (!query.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetchGraph({ action: 'search', q: query.trim() }, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) {
            setResults(data.items ?? []);
            setError('');
          }
        })
        .catch((reason) => {
          if (!controller.signal.aborted)
            setError(reason instanceof Error ? reason.message : '知识检索失败');
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, fetchGraph]);

  const navigate = async (key?: string, offset = 0) => {
    const seq = ++revision.current;
    setQuery('');
    setResults([]);
    setError('');
    try {
      const data = await fetchGraph(
        key
          ? { action: 'subgraph', key, offset: String(offset) }
          : { action: 'browse' },
      );
      if (seq !== revision.current) return;
      setGraph(data.graph);
      setCoverage(data.coverage_label ?? '');
      setPage(
        key
          ? {
              key,
              offset,
              total: data.total,
              returned: data.returned,
              truncated: data.truncated,
            }
          : null,
      );
    } catch (reason) {
      if (seq === revision.current)
        setError(reason instanceof Error ? reason.message : '知识图谱读取失败');
    }
  };

  return (
    <details
      ref={atlas}
      className="public-knowledge-atlas"
      open={opened}
      onToggle={(event) => setOpened(event.currentTarget.open)}
    >
      <summary>公共知识路径</summary>
      {opened && (
        <>
          <p>{coverage || '按教材与学科的公共知识结构浏览。'}</p>
          <input
            aria-label="检索公共知识点"
            placeholder="检索知识点"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setResults([]);
            }}
          />
          {query.trim() && !!results.length && (
            <div className="knowledge3d-public-results">
              {results.map((node) => (
                <button
                  key={node.id}
                  onClick={() => void navigate(node.key ?? node.id)}
                >
                  {node.name}
                </button>
              ))}
            </div>
          )}
          {error && <p role="alert">{error}</p>}
          {graph && (
            <>
              <div className="knowledge3d-public-results">
                <button onClick={() => void navigate()}>学科入口</button>
                {graph.nodes
                  .filter((node) =>
                    ['topic', 'subject'].includes(node.node_kind ?? ''),
                  )
                  .slice(0, 24)
                  .map((node) => (
                    <button
                      key={node.id}
                      onClick={() => void navigate(node.key ?? node.id)}
                    >
                      展开 {node.name}
                    </button>
                  ))}
              </div>
              {page && (
                <p>
                  当前 {page.returned} / {page.total} 个相关节点
                  {page.offset > 0 && (
                    <button
                      onClick={() =>
                        void navigate(page.key, Math.max(0, page.offset - 200))
                      }
                    >
                      上一页
                    </button>
                  )}
                  {page.truncated && (
                    <button
                      onClick={() =>
                        void navigate(page.key, page.offset + page.returned)
                      }
                    >
                      下一页
                    </button>
                  )}
                </p>
              )}
              <KnowledgeGraph3D
                view="public"
                graph={graph}
                onExpandNode={(node) => void navigate(node.key ?? node.id)}
              />
            </>
          )}
        </>
      )}
    </details>
  );
}
