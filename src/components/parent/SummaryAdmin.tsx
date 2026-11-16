'use client';

import { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { summarizeDay } from '@/lib/ai/mentor';
import { buildLocalSummary } from '@/lib/logic/summary';
import { QTYPE_BADGES } from '@/lib/logic/questionClassifier';
import type { DailySummary, QuestionType } from '@/lib/types';
import { dayKey } from '@/lib/util';

export function SummaryAdmin() {
  const { game, mentor, mode } = useApp();
  const [day, setDay] = useState(dayKey());
  const [sum, setSum] = useState<DailySummary | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void game.repo.summaries.get(day).then((s) => setSum(s ?? null));
  }, [game, day]);

  const generate = async () => {
    setBusy(true);
    const [logs, ledger, usage] = await Promise.all([game.repo.logs.all(), game.repo.ledger.all(), game.repo.usage.get(day)]);
    const s = buildLocalSummary(day, logs, ledger, usage);
    if (mode === 'llm') {
      const facts = `日期 ${day}\n使用 ${s.minutesUsed} 分钟，获得 ${s.starsEarned} 颗星。\n提问：\n${s.questions.map((q) => `- [${q.qtype}] ${q.text}`).join('\n') || '无'}\n兴趣：${s.interests.join('、') || '无'}\n安全提醒：${s.safetyFlags.map((f) => f.text).join('；') || '无'}\n任务记录：\n${logs
        .filter((l) => l.day === day && l.module === 'mission')
        .slice(-30)
        .map((l) => `${l.role === 'child' ? '孩子' : '小星'}：${l.text}`)
        .join('\n')}`;
      const narrative = await summarizeDay(mentor(), facts);
      if (narrative) Object.assign(s, { narrative, mode: 'llm' });
    }
    await game.repo.summaries.put(s);
    setSum(s);
    setBusy(false);
  };

  const max = sum ? Math.max(1, ...Object.values(sum.typeCounts)) : 1;
  return (
    <div className="p-section" data-testid="summary">
      <h2>📊 每日摘要</h2>
      <div className="row gap">
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        <button className="p-btn primary" data-testid="gen-summary" disabled={busy} onClick={generate}>
          {busy ? '生成中…' : sum ? '重新生成' : '生成摘要'}
        </button>
        <span className="muted">{mode === 'llm' ? '将用 AI 写总结 + 本地统计' : '演示模式：本地统计'}</span>
      </div>
      {sum && (
        <div className="summary">
          <div className="p-stats">
            <div>
              <b>{sum.questions.length}</b>
              <small>提问</small>
            </div>
            <div>
              <b>{sum.starsEarned}</b>
              <small>获得星星</small>
            </div>
            <div>
              <b>{sum.minutesUsed}′</b>
              <small>使用时长</small>
            </div>
            <div className={sum.safetyFlags.length ? 'warn' : ''}>
              <b>{sum.safetyFlags.length}</b>
              <small>安全提醒</small>
            </div>
          </div>
          {sum.narrative && <div className="p-card narrative">{sum.narrative}</div>}
          <h3>提问类型分布</h3>
          <div className="bars">
            {(Object.keys(sum.typeCounts) as QuestionType[]).map((k) => (
              <div key={k} className="bar-row">
                <span>
                  {QTYPE_BADGES[k].icon} {QTYPE_BADGES[k].name.zh}
                </span>
                <span className="bar">
                  <i style={{ width: `${(sum.typeCounts[k] / max) * 100}%` }} />
                </span>
                <b>{sum.typeCounts[k]}</b>
              </div>
            ))}
          </div>
          <h3>兴趣点</h3>
          <p>{sum.interests.join('、') || '暂无'}</p>
          <h3>提问清单</h3>
          <ol>
            {sum.questions.map((q, i) => (
              <li key={i}>
                {q.qtype && QTYPE_BADGES[q.qtype].icon} {q.text}
              </li>
            ))}
          </ol>
          {sum.safetyFlags.length > 0 && (
            <>
              <h3>⚠️ 安全提醒</h3>
              <ul>
                {sum.safetyFlags.map((f, i) => (
                  <li key={i}>
                    {new Date(f.ts).toLocaleTimeString('zh-CN', { hour12: false })} {f.text}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="muted">生成于 {new Date(sum.generatedTs).toLocaleString('zh-CN', { hour12: false })}（{sum.mode === 'llm' ? 'AI' : '本地'}）</p>
        </div>
      )}
    </div>
  );
}
