'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BatteryFull,
  FileText,
  Send,
  Signal,
  Wifi,
  ChevronLeft,
} from 'lucide-react';
import type {
  DayQuestion,
  DayStudent,
  DayTurn,
} from '@/lib/world/school-day-contract';
import StudyMarkdown from './study-markdown';

const typeNames: Record<string, string> = {
  choice: '选择',
  fill_blank: '填空',
  true_false: '判断',
  short_answer: '简答',
  calculation: '计算',
  material: '材料题',
};
export function answerText(answer: unknown): string {
  if (answer === null || answer === undefined) return '';
  if (typeof answer === 'string') return answer;
  if (typeof answer === 'boolean') return answer ? '正确' : '错误';
  if (Array.isArray(answer)) return answer.map(answerText).join('、');
  if (typeof answer === 'object')
    return Object.entries(answer as Record<string, unknown>)
      .map(([k, v]) => `${k}：${answerText(v)}`)
      .join('\n');
  return typeof answer === 'number' || typeof answer === 'bigint'
    ? String(answer)
    : '';
}
function stepFindingText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const finding = value as { step_index?: unknown; finding?: unknown };
  if (typeof finding.finding !== 'string') return '';
  return typeof finding.step_index === 'number' &&
    Number.isInteger(finding.step_index) &&
    finding.step_index >= 0
    ? `第 ${finding.step_index + 1} 步：${finding.finding}`
    : finding.finding;
}
export function QuestionContent({ question }: { question: DayQuestion }) {
  return (
    <>
      {question.context && (
        <StudyMarkdown
          text={question.context}
          className="sd-question-context"
        />
      )}
      <StudyMarkdown text={question.prompt || ''} />
      {question.options?.length ? (
        <div className="sd-options">
          {question.options.map((option) => (
            <div key={option.id}>
              <b>{option.id}.</b>
              <StudyMarkdown text={option.text} />
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function PhoneSession({
  student,
  time,
  onSend,
  disabled,
  disabledReason,
  busy,
  focus,
}: {
  student?: DayStudent;
  runId: string;
  time: string;
  onSend: (
    text: string,
    itemId?: string,
    assignmentId?: string,
  ) => Promise<void>;
  disabled: boolean;
  disabledReason?: string;
  busy: boolean;
  focus?: { assignmentId: string; itemId?: string; nonce: number };
}) {
  const [tab, setTab] = useState<'work' | 'chat'>(focus ? 'chat' : 'work');
  const [itemId, setItemId] = useState(focus?.itemId || '');
  const [assignmentId, setAssignmentId] = useState(focus?.assignmentId || '');
  const [draft, setDraft] = useState('');
  const [raw, setRaw] = useState(false);
  const [sendError, setSendError] = useState('');
  const feed = useRef<HTMLDivElement>(null);
  const bottom = useRef(true);
  const assignments = student?.assignments?.length
    ? student.assignments
    : student?.homework
      ? [student.homework]
      : [];
  const homework =
    assignments.find((work) => work.assignment_id === assignmentId) ||
    student?.homework ||
    assignments[assignments.length - 1];
  const items = homework?.items || [];
  const correctnessScale =
    homework?.score_scale === 'one_point_per_item' ||
    homework?.score_scale === 'mixed';
  const selected = items.find((item) => item.id === itemId);
  const inputDisabled = disabled || !homework?.review;
  const inputHint = disabled
    ? disabledReason || '到家后开始交流'
    : !homework?.review
      ? '等待作业批改'
      : '说说你的想法…';
  const messages: DayTurn[] = (student?.app_session?.transcript || []).filter(
    (turn) =>
      (!turn.assignment_id || turn.assignment_id === homework?.assignment_id) &&
      (!itemId || turn.item_id === itemId),
  );
  useEffect(() => {
    if (tab === 'chat' && bottom.current) {
      feed.current?.scrollTo({
        top: feed.current.scrollHeight,
        behavior: 'auto',
      });
    }
  }, [messages.length, tab, itemId, assignmentId]);
  const ask = (question: DayQuestion) => {
    setItemId(question.id);
    setTab('chat');
    setDraft('');
    bottom.current = true;
  };
  const send = async () => {
    if (!draft.trim() || busy || inputDisabled) return;
    const text = draft.trim();
    setSendError('');
    try {
      await onSend(text, itemId || undefined, homework?.assignment_id);
      setDraft('');
      bottom.current = true;
    } catch (error) {
      setSendError(error instanceof Error ? error.message : '发送失败');
    }
  };
  const answers = homework?.answers || [],
    reviews = homework?.review?.items || [];
  const earned = reviews.reduce((n, item) => n + (item.score ?? 0), 0);
  const possible = reviews.reduce(
    (n, item) =>
      n +
      (item.score === null || item.score === undefined
        ? 0
        : (item.max_score ?? 0)),
    0,
  );
  const uncertainReviews = reviews.filter(
    (item) => item.score === null || item.score === undefined,
  ).length;
  const completeAnswers = answers.filter(
    (answer) =>
      answer.response_kind === 'answer' &&
      answerText(answer.answer ?? answer.text).trim(),
  ).length;
  const partialAnswers = answers.filter(
    (answer) =>
      answer.response_kind === 'partial' &&
      answerText(answer.answer ?? answer.text).trim(),
  ).length;
  return (
    <div className="sd-phone-device" data-student-id={student?.id || ''}>
      <section
        className="sd-phone-screen"
        aria-label={`${student?.name || '学生'}的学习 APP`}
      >
        <div className="sd-phone-statusbar">
          <span>{time}</span>
          <span>
            <Signal size={12} />
            <Wifi size={12} />
            <BatteryFull size={17} />
          </span>
        </div>
        <header className="sd-phone-header">
          <div className="sd-phone-title">
            <span className="sd-app-avatar">◕</span>
            <div>
              <h2>学习伙伴</h2>
              <p>
                {student?.name ? `${student.name}的学习空间` : '个人学习空间'}
              </p>
            </div>
          </div>
          <div className="sd-phone-tabs" role="tablist" aria-label="学习内容">
            <button
              role="tab"
              aria-selected={tab === 'work'}
              className={tab === 'work' ? 'active' : ''}
              onClick={() => setTab('work')}
            >
              今日作业 {items.length ? `· ${items.length}` : ''}
            </button>
            <button
              role="tab"
              aria-selected={tab === 'chat'}
              className={tab === 'chat' ? 'active' : ''}
              onClick={() => {
                setTab('chat');
                bottom.current = true;
              }}
            >
              交流 {messages.length ? `· ${messages.length}` : ''}
            </button>
          </div>
        </header>
        <div
          ref={feed}
          className="sd-phone-feed"
          tabIndex={0}
          role="tabpanel"
          aria-label={tab === 'work' ? '整份作业与批改' : '学习对话'}
          onScroll={() => {
            const node = feed.current;
            if (node)
              bottom.current =
                node.scrollHeight - node.scrollTop - node.clientHeight < 90;
          }}
        >
          {assignments.length > 1 && (
            <div className="sd-assignment-picker">
              <select
                aria-label="选择作业"
                value={homework?.assignment_id || ''}
                onChange={(event) => {
                  setAssignmentId(event.target.value);
                  setItemId('');
                  setDraft('');
                  setSendError('');
                  feed.current?.scrollTo({ top: 0 });
                }}
              >
                {assignments.map((work, index) => (
                  <option key={work.assignment_id} value={work.assignment_id}>
                    第 {work.day || index + 1} 天 · {work.title || '课堂作业'}
                  </option>
                ))}
              </select>
            </div>
          )}
          {tab === 'work' ? (
            <>
              {items.length > 0 ? (
                <>
                  <div className="sd-work-summary">
                    <FileText size={21} />
                    <div>
                      <strong>{homework?.title || '本课作业'}</strong>
                      <p>
                        完整作答 {completeAnswers}/{items.length} · 已批改{' '}
                        {reviews.length}/{items.length}
                      </p>
                      <p>
                        记录 {answers.length} 题 · 部分作答 {partialAnswers} 题
                        · {homework?.submission ? '整份已提交' : '准备整份提交'}
                      </p>
                      {possible > 0 && (
                        <p className="sd-review-total">
                          {correctnessScale
                            ? `正确 ${reviews.filter((review) => review.correct === true).length} / ${reviews.length - uncertainReviews} 题`
                            : `${earned} / ${possible} 分`}
                          {uncertainReviews > 0 ? ' · 已判定题目' : ''}
                        </p>
                      )}
                      {uncertainReviews > 0 && (
                        <p>另有 {uncertainReviews} 题待判定</p>
                      )}
                    </div>
                  </div>
                  {items.map((item, index) => {
                    const answer = answers.find((a) => a.item_id === item.id);
                    const review = reviews.find((r) => r.item_id === item.id);
                    return (
                      <article
                        className="sd-work-item"
                        key={item.id}
                        data-item-id={item.id}
                      >
                        <div className="sd-question-meta">
                          <span>
                            {String(index + 1).padStart(2, '0')} ·{' '}
                            {typeNames[item.type] ||
                              item.type ||
                              (homework?.origin === 'uploaded_material'
                                ? '材料题'
                                : '')}
                          </span>
                          <span>
                            {item.score_scale === 'one_point_per_item' ||
                            (correctnessScale && !item.score_scale)
                              ? review
                                ? review.correct === true
                                  ? '正确'
                                  : review.correct === false
                                    ? '需订正'
                                    : '待判断'
                                : '待批改'
                              : review
                                ? `${review.score ?? '—'} / ${review.max_score ?? item.max_score} 分`
                                : `${item.max_score} 分`}
                          </span>
                        </div>
                        <QuestionContent question={item} />
                        <div className="sd-original-answer">
                          <small>我的作答</small>
                          {answer ? (
                            <>
                              <StudyMarkdown
                                text={
                                  answerText(answer.answer ?? answer.text) ||
                                  '本题保留空白'
                                }
                              />
                              {answer.steps && (
                                <StudyMarkdown
                                  text={
                                    Array.isArray(answer.steps)
                                      ? answer.steps.join('\n')
                                      : answer.steps
                                  }
                                />
                              )}
                            </>
                          ) : (
                            <p>等待作答</p>
                          )}
                        </div>
                        {review && (
                          <div
                            className={`sd-item-review ${review.correct === true ? 'correct' : review.correct === false ? 'incorrect' : 'uncertain'}`}
                          >
                            <strong>
                              {review.correct === true
                                ? '✓ 本题正确'
                                : review.correct === false
                                  ? '一起看看这道题'
                                  : '还需要补充信息'}
                            </strong>
                            {review.explanation && (
                              <StudyMarkdown text={review.explanation} />
                            )}{' '}
                            {!!review.step_findings?.length && (
                              <div className="sd-step-findings">
                                {review.step_findings.map((finding, i) => (
                                  <StudyMarkdown
                                    key={i}
                                    text={stepFindingText(finding)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <button
                          className="sd-ask-item"
                          onClick={() => ask(item)}
                        >
                          聊聊这道题 <span>↗</span>
                        </button>
                      </article>
                    );
                  })}
                </>
              ) : (
                <div className="sd-phone-empty">
                  <FileText size={35} />
                  <strong>作业会出现在这里</strong>
                  <p>完成课堂学习后，老师会布置本课作业。</p>
                </div>
              )}
            </>
          ) : (
            <>
              {selected && (
                <div className="sd-chat-question">
                  <button
                    onClick={() => setItemId('')}
                    aria-label="回到全部对话"
                  >
                    <ChevronLeft size={14} /> 全部对话
                  </button>
                  <QuestionContent question={selected} />
                </div>
              )}
              {messages.length ? (
                messages.map((turn, index) => (
                  <article
                    className={`sd-message ${turn.role === 'student' ? 'student' : 'teacher'}`}
                    key={turn.id || `${student?.app_session?.id}-${index}`}
                    data-message-id={turn.id}
                  >
                    <div className="sd-message-role">
                      {turn.role === 'student' ? student?.name : '学习伙伴'}
                      {turn.item_id && (
                        <button onClick={() => setItemId(turn.item_id!)}>
                          题目{' '}
                          {Math.max(
                            0,
                            items.findIndex((i) => i.id === turn.item_id),
                          ) + 1}
                        </button>
                      )}
                    </div>
                    {raw ? (
                      <pre className="sd-raw-message">{turn.text}</pre>
                    ) : (
                      <StudyMarkdown text={turn.text} />
                    )}
                  </article>
                ))
              ) : (
                <div className="sd-phone-empty">
                  <span className="sd-app-avatar">◕</span>
                  <strong>
                    {selected ? '这道题还没有交流记录' : '从你的问题开始'}
                  </strong>
                  <p>
                    {selected
                      ? '把想法、疑问或解题步骤写下来。'
                      : '选择一道作业题，和学习伙伴一起讨论。'}
                  </p>
                </div>
              )}
              {busy && <output className="sd-chat-wait">正在思考…</output>}
            </>
          )}
        </div>
        <footer className="sd-phone-footer">
          {tab === 'chat' && (
            <>
              <form
                className="sd-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send();
                }}
              >
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={inputHint}
                  aria-label="给学习伙伴的消息"
                  rows={2}
                  disabled={inputDisabled || busy}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                />
                <button
                  type="submit"
                  aria-label="发送消息"
                  disabled={inputDisabled || busy || !draft.trim()}
                >
                  <Send size={16} />
                </button>
              </form>
              {sendError && (
                <p className="sd-phone-error" role="alert">
                  {sendError}
                </p>
              )}
            </>
          )}
          <div className="sd-reading-actions">
            <button
              onClick={() =>
                feed.current?.scrollTo({ top: 0, behavior: 'auto' })
              }
            >
              <ArrowUp size={12} />
              开头
            </button>
            <button
              onClick={() => {
                bottom.current = true;
                feed.current?.scrollTo({
                  top: feed.current.scrollHeight,
                  behavior: 'auto',
                });
              }}
            >
              <ArrowDown size={12} />
              结尾
            </button>
            <button
              onClick={() => setRaw((value) => !value)}
              aria-pressed={raw}
            >
              {raw ? '排版阅读' : '原始文本'}
            </button>
          </div>
          <div className="sd-home-indicator" />
        </footer>
      </section>
    </div>
  );
}

export default function SchoolDayPhone(
  props: Parameters<typeof PhoneSession>[0],
) {
  return (
    <PhoneSession
      key={`${props.runId}:${props.student?.id || ''}:${props.focus?.nonce || ''}`}
      {...props}
    />
  );
}
