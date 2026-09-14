'use client';

import type { CharacterSettings } from '@/lib/world/learning-contract';
import type { DayStudent } from '@/lib/world/school-day-contract';
import StudentFigure3D from './student-figure3d';

const attributes = [
  ['learning_rate', '学习速度', '影响每分钟学习带来的状态变化'],
  ['retention', '保持倾向', '影响学习后的遗忘速率'],
  ['diligence', '学习投入', '影响活动中的有效学习增量'],
  ['initial_preparation', '起始准备', '决定新目标的初始模拟基础'],
  ['help_seeking', '求助主动性', '影响人物遇到困难时的表达'],
] as const;

export default function LearnerCharacterCard({
  student,
  character,
  nodeNames = {},
}: {
  student: DayStudent;
  character?: CharacterSettings | null;
  nodeNames?: Record<string, string>;
}) {
  const knownAppearance = (
    student as DayStudent & { appearance?: CharacterSettings['appearance'] }
  ).appearance;
  return (
    <section
      className="learner-character-card"
      aria-label={`${student.name}的人物设定`}
    >
      <div className="learner-character-overview">
        <StudentFigure3D
          name={student.name}
          color={student.color}
          appearance={character?.appearance ?? knownAppearance}
        />
        <div className="learner-character-description">
          <small>青河市 · 学生</small>
          <h3>{student.name}</h3>
          {character ? (
            <>
              <p className="learner-character-identity">
                <span>
                  {
                    { female: '女生', male: '男生', unspecified: '性别未设定' }[
                      character.gender
                    ]
                  }
                </span>
                <span>
                  {typeof character.grade === 'number' ||
                  /^\d+$/.test(String(character.grade))
                    ? `${character.grade}年级`
                    : character.grade || '年级待记录'}
                </span>
              </p>
              <h4>学习方式</h4>
              <p>{character.learning_style}</p>
              {!!character.interests.length && (
                <div className="learner-interests">
                  {character.interests.map((interest) => (
                    <span key={interest}>{interest}</span>
                  ))}
                </div>
              )}
              <div className="learner-character-attributes">
                {attributes.map(([key, label, description]) => (
                  <div key={key} title={description}>
                    <label>
                      {label}
                      <strong>{Math.round(character[key] * 100)}%</strong>
                    </label>
                    <meter
                      aria-label={label}
                      min={0}
                      max={1}
                      value={character[key]}
                    />
                    <small>{description}</small>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="learning-muted">
              这份运行尚未保存完整的人物学习属性。已记录的学习经历可在对应页面查看。
            </p>
          )}
        </div>
      </div>
      {character && (
        <>
          <div className="learner-character-task">
            <h4>任务设定</h4>
            <p className="learner-task-goal">{character.task.goal}</p>
            <p>
              期望每日练习{' '}
              <strong>{character.task.daily_practice_minutes}</strong> 模拟分钟
            </p>
            <p>{character.task.response_style}</p>
          </div>
          {!!character.initial_knowledge?.length && (
            <details className="learner-rubric">
              <summary>
                初始已学目标 · {character.initial_knowledge.length} 个
              </summary>
              {character.initial_knowledge.map((node) => (
                <p key={node.node_id}>
                  {nodeNames[node.node_id] ?? node.node_id}
                  <strong> · {Math.round(node.mastery * 100)}%</strong>
                </p>
              ))}
            </details>
          )}
          <details className="learner-rubric">
            <summary>人物来源与外观</summary>
            <p>
              人物种子 {character.seed ?? '尚未记录'} ·
              学习属性作为本次模拟的初始条件。
            </p>
            <div className="learner-appearance-values">
              {(
                [
                  ['skin', '肤色'],
                  ['hair', '发色'],
                  ['clothing', '服装'],
                ] as const
              ).map(([key, label]) => (
                <span key={key}>
                  <i style={{ background: character.appearance[key] }} />
                  {label} {character.appearance[key]}
                </span>
              ))}
              <span>身高比例 {character.appearance.height.toFixed(2)}</span>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
