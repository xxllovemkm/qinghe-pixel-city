'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { FileText, Upload } from 'lucide-react';
import { EDUCATION_API, educationRequest } from '@/lib/education-api';
import type { DayStudent } from '@/lib/world/school-day-contract';
import type {
  LearningMaterial,
  MaterialAssignment,
  MaterialItem,
  MaterialJob,
} from '@/lib/world/learning-contract';

type Props = {
  runId: string;
  student: DayStudent;
  onDiscussMaterial?: (assignmentId: string, itemId: string) => void;
};
const statusName = (status: string) =>
  (
    ({
      queued: '等待处理',
      running: '正在读取材料',
      complete: '已完成',
      completed: '已完成',
      ready: '可查看',
      parsed: '已读取',
      needs_input: '待补充材料',
      needs_review: '待核对',
      partial: '部分完成',
      interrupted: '处理中断，可继续',
      error: '处理未完成',
      predicted: '已形成候选判断',
      mapped: '已完成关联',
      needs_model: '等待模型判定',
      unmapped: '尚待关联',
    }) as Record<string, string>
  )[status] ?? status;
const flatten = (items: MaterialItem[]): MaterialItem[] =>
  items.flatMap((item) => [item, ...flatten(item.parts ?? [])]);
const errorText = (reason: unknown) =>
  reason instanceof Error ? reason.message : '材料服务暂时不可用';

export default function MaterialInbox(props: Props) {
  return (
    <MaterialSession key={`${props.runId}:${props.student.id}`} {...props} />
  );
}

function MaterialSession({ runId, student, onDiscussMaterial }: Props) {
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [material, setMaterial] = useState<LearningMaterial | null>(null);
  const [job, setJob] = useState<MaterialJob | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [feedback, setFeedback] = useState(false);
  const [doublePage, setDoublePage] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [focusItem, setFocusItem] = useState<string | null>(null);
  const [correction, setCorrection] = useState('');
  const [field, setField] = useState('text');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const selection = useRef(0);
  const scope = new URLSearchParams({
    run_id: runId,
    student_id: student.id,
  }).toString();
  const read = useCallback(
    <T,>(path: string, signal?: AbortSignal) =>
      educationRequest<T>(`${path}?${scope}`, undefined, signal),
    [scope],
  );
  const rows = flatten(material?.items ?? []);
  const current = rows.find((row) => row.id === focusItem);
  const page =
    material?.pages.find((row) => row.index === pageIndex) ??
    material?.pages[0];
  const assignment = student.assignments?.find(
    (row) => row.assignment_id === material?.assignment_id,
  ) as MaterialAssignment | undefined;
  const mapping =
    material?.mapping ??
    material?.mapping_runs?.at(-1) ??
    assignment?.material_mapping;

  const loadMaterial = useCallback(
    async (id: string) => {
      const seq = ++selection.current;
      const data = await read<LearningMaterial>(
        `/materials/${encodeURIComponent(id)}`,
      );
      if (
        !alive.current ||
        seq !== selection.current ||
        data.run_id !== runId ||
        data.owner_id !== student.id
      )
        return;
      setMaterial(data);
      setChosen(data.items.map((item) => item.id));
      setPageIndex(data.pages[0]?.index ?? 0);
      setFocusItem(null);
      setMaterials((previous) => [
        data,
        ...previous.filter((row) => row.id !== data.id),
      ]);
    },
    [read, runId, student.id],
  );

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void read<{
      run_id: string;
      student_id: string;
      materials: LearningMaterial[];
      jobs?: MaterialJob[];
    }>('/materials', controller.signal)
      .then((data) => {
        if (
          controller.signal.aborted ||
          data.run_id !== runId ||
          data.student_id !== student.id
        )
          return;
        setMaterials(data.materials ?? []);
        const latest =
          data.jobs?.findLast((row) =>
            ['queued', 'running'].includes(row.status),
          ) ?? data.jobs?.at(-1);
        if (latest) {
          setJob(latest);
          setBusy(['queued', 'running'].includes(latest.status));
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(errorText(reason));
      });
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [read, runId, student.id]);

  useEffect(() => {
    if (!job || !['queued', 'running'].includes(job.status)) return;
    const controller = new AbortController();
    let pending = false;
    const timer = window.setInterval(() => {
      if (pending) return;
      pending = true;
      void read<MaterialJob>(
        `/materials/jobs/${encodeURIComponent(job.id)}`,
        controller.signal,
      )
        .then(async (data) => {
          if (controller.signal.aborted) return;
          setJob(data);
          if (!['queued', 'running'].includes(data.status)) {
            setBusy(false);
            if (data.material_id) await loadMaterial(data.material_id);
            if (data.error) setError(data.error);
          }
        })
        .catch((reason) => {
          if (!controller.signal.aborted) {
            setError(errorText(reason));
            setBusy(false);
          }
        })
        .finally(() => {
          pending = false;
        });
    }, 1200);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [job, read, loadMaterial]);

  const act = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    try {
      const result = await educationRequest<{
        job?: MaterialJob;
        material?: LearningMaterial;
      }>('/materials', {
        ...payload,
        run_id: runId,
        student_id: student.id,
        request_id: crypto.randomUUID(),
      });
      if (!alive.current) return;
      if (result.job) setJob(result.job);
      if (result.job?.error) setError(result.job.error);
      if (result.material) {
        setMaterial(result.material);
        setMaterials((previous) => [
          result.material!,
          ...previous.filter((row) => row.id !== result.material!.id),
        ]);
      }
      if (!result.job || !['queued', 'running'].includes(result.job.status)) {
        setBusy(false);
        if (result.job?.material_id) await loadMaterial(result.job.material_id);
      }
    } catch (reason) {
      if (alive.current) {
        setError(errorText(reason));
        setBusy(false);
      }
    }
  };

  const upload = async (file?: File) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setError('请选择 20 MB 以内的材料。');
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!alive.current) return;
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    await act({
      action: 'upload',
      filename: file.name,
      content_base64: btoa(binary),
      split_mode: doublePage ? 'double_page' : 'auto',
    });
    if (input.current) input.current.value = '';
  };
  const materialUrl = material
    ? `${EDUCATION_API}/api/school-day/materials/${encodeURIComponent(material.id)}`
    : '';
  const asset = page?.asset
    ? `${materialUrl}/assets/${encodeURIComponent(page.asset)}?${scope}`
    : null;

  return (
    <section
      className="material-inbox"
      aria-label={`${student.name}的个人材料`}
    >
      <header>
        <FileText size={18} />
        <div>
          <h3>个人材料</h3>
          <p>把 {student.name} 的题目照片、作业或试卷带进当前学习 APP。</p>
        </div>
      </header>
      <div className="material-inbox-toolbar">
        <label className="material-upload">
          <Upload size={15} />
          上传材料
          <input
            ref={input}
            type="file"
            aria-label="上传学习材料"
            accept="image/png,image/jpeg,image/webp,application/pdf,.docx,.txt"
            disabled={busy}
            onChange={(event) =>
              void upload(event.target.files?.[0]).catch((reason) =>
                setError(errorText(reason)),
              )
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={doublePage}
            onChange={(event) => setDoublePage(event.target.checked)}
          />
          PDF 双页拼接
        </label>
      </div>
      {job && <output>{statusName(job.status)}</output>}
      {job && ['interrupted', 'error'].includes(job.status) && (
        <button
          disabled={busy}
          onClick={() => void act({ action: 'resume', job_id: job.id })}
        >
          继续处理
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      {!!materials.length && (
        <nav aria-label="已上传材料">
          {materials.map((row) => (
            <button
              key={row.id}
              disabled={busy}
              aria-pressed={material?.id === row.id}
              onClick={() =>
                void loadMaterial(row.id).catch((reason) =>
                  setError(errorText(reason)),
                )
              }
            >
              {row.filename ?? '学习材料'} · {statusName(row.status)}
            </button>
          ))}
        </nav>
      )}
      {material && (
        <>
          <p>
            {material.pages.length} 页 · {rows.length} 个题目与子问 ·{' '}
            {statusName(material.status)}
          </p>
          <div className="material-pages">
            {material.pages.map((row) => (
              <button
                key={row.index}
                aria-pressed={page?.index === row.index}
                onClick={() => setPageIndex(row.index)}
              >
                第 {row.index + 1} 页
              </button>
            ))}
          </div>
          {asset && (
            <div className="material-source">
              <Image
                src={asset}
                alt={`材料原件第 ${(page?.index ?? 0) + 1} 页`}
                width={1200}
                height={1600}
                unoptimized
              />
              {current?.source_regions
                ?.filter(
                  (region) =>
                    region.page_index === page?.index &&
                    region.bbox?.length === 4,
                )
                .map((region, i) => {
                  const [x, y, right, bottom] = region.bbox!;
                  return (
                    <span
                      key={i}
                      className="material-region"
                      style={{
                        left: `${x * 100}%`,
                        top: `${y * 100}%`,
                        width: `${(right - x) * 100}%`,
                        height: `${(bottom - y) * 100}%`,
                      }}
                    />
                  );
                })}
            </div>
          )}
          {!asset && page?.text && (
            <pre className="material-page-text">{page.text}</pre>
          )}
          {!!material.unresolved_regions?.length && (
            <p>
              有 {material.unresolved_regions.length}{' '}
              处内容待核对，可选择题目补充原文或本人作答。
            </p>
          )}
          <div className="material-items">
            {rows.map((item) => (
              <article key={item.id} data-selected={current?.id === item.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={chosen.includes(item.id)}
                    aria-label={`分享题目 ${item.id}`}
                    onChange={(event) =>
                      setChosen((previous) =>
                        event.target.checked
                          ? [...new Set([...previous, item.id])]
                          : previous.filter((id) => id !== item.id),
                      )
                    }
                  />
                  与 APP 讨论
                </label>
                <button
                  className="material-item-text"
                  onClick={() => {
                    setFocusItem(item.id);
                    setCorrection(item.text);
                    setField('text');
                    setPageIndex(item.source_regions?.[0]?.page_index ?? 0);
                  }}
                >
                  {item.text || '题目内容待补充'}
                </button>
                {item.own_answer != null && (
                  <p>
                    本人原答：
                    {typeof item.own_answer === 'string'
                      ? item.own_answer
                      : JSON.stringify(item.own_answer)}
                  </p>
                )}
                {!!item.uncertainties?.length && (
                  <div className="material-uncertainties">
                    <strong>识别待核对</strong>
                    {item.uncertainties.map((uncertainty, index) => {
                      const pages = [
                        ...new Set(
                          (uncertainty.source_regions ?? [])
                            .map((region) => region.page_index)
                            .filter(
                              (pageIndex) =>
                                Number.isInteger(pageIndex) && pageIndex >= 0,
                            ),
                        ),
                      ];
                      return (
                        <div key={index}>
                          <p>{uncertainty.reason}</p>
                          {!!pages.length && (
                            <small>
                              第{' '}
                              {pages
                                .map((pageIndex) => pageIndex + 1)
                                .join('、')}{' '}
                              页
                            </small>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {assignment?.items.some(
                  (question) => question.id === item.id,
                ) &&
                  onDiscussMaterial && (
                    <button
                      onClick={() =>
                        onDiscussMaterial(assignment.assignment_id, item.id)
                      }
                    >
                      到学习 APP 讨论这道题
                    </button>
                  )}
              </article>
            ))}
          </div>
          {current && (
            <div className="material-correction">
              <label>
                补充内容
                <select
                  aria-label="补充字段"
                  value={field}
                  onChange={(event) => setField(event.target.value)}
                >
                  <option value="text">题目原文</option>
                  <option value="student_answer">本人作答</option>
                  <option value="teacher_annotation">教师批注</option>
                </select>
              </label>
              <textarea
                aria-label="材料补充内容"
                value={correction}
                onChange={(event) => setCorrection(event.target.value)}
              />
              <button
                disabled={busy || !correction.trim()}
                onClick={() =>
                  void act({
                    action: 'correct',
                    material_id: material.id,
                    item_id: current.id,
                    field,
                    text: correction,
                  })
                }
              >
                保存补充
              </button>
            </div>
          )}
          <label>
            <input
              type="checkbox"
              checked={feedback}
              onChange={(event) => setFeedback(event.target.checked)}
            />
            同时分享已有反馈
          </label>
          <button
            className="material-share"
            disabled={busy || !chosen.length}
            onClick={() =>
              void act({
                action: 'share',
                material_id: material.id,
                item_ids: chosen,
                include_feedback: feedback,
              })
            }
          >
            分享所选题目并关联知识
          </button>
          {mapping && (
            <details className="material-mapping">
              <summary>题目知识关联</summary>
              {(mapping.items ?? [])
                .flatMap((row) => [row, ...(row.parts ?? [])])
                .map((row, index) => (
                  <article key={row.item_id ?? index}>
                    <p>
                      {row.mapped_input?.text ??
                        rows.find((item) => item.id === row.item_id)?.text}
                    </p>
                    <small>{statusName(row.status ?? '')}</small>
                    {row.reason && <p>{row.reason}</p>}
                    {row.targets?.map((target, i) => (
                      <div key={`${target.node_key}-${i}`}>
                        <strong>
                          {
                            (
                              {
                                primary: '主要考查',
                                auxiliary: '辅助运用',
                                prerequisite: '必要前置',
                              } as Record<string, string>
                            )[target.relation ?? 'primary']
                          }{' '}
                          ·{' '}
                          {target.node_definition?.name ??
                            target.node_key ??
                            target.node_id}
                        </strong>
                        <p>{target.evidence}</p>
                        <details>
                          <summary>关联依据</summary>
                          <p>{target.definition_evidence}</p>
                        </details>
                      </div>
                    ))}
                  </article>
                ))}
            </details>
          )}
          <details>
            <summary>材料来源</summary>
            <p>
              <a
                href={`${materialUrl}/source?${scope}`}
                target="_blank"
                rel="noreferrer"
              >
                {material.filename} · 查看原件
              </a>
            </p>
            <code>SHA-256 {material.file_sha256}</code>
          </details>
        </>
      )}
    </section>
  );
}
