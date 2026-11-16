'use client';

import { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { QTYPE_BADGES } from '@/lib/logic/questionClassifier';
import type { LogMessage } from '@/lib/types';
import { dayKey } from '@/lib/util';

export function LogsAdmin() {
  const { game, dataVersion } = useApp();
  const [day, setDay] = useState(dayKey());
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [onlyFlags, setOnlyFlags] = useState(false);
  useEffect(() => {
    void (async () => {
      const all = await game.repo.logs.all();
      setDays([...new Set(all.map((l) => l.day))].sort().reverse());
      setLogs(all.filter((l) => l.day === day).sort((a, b) => a.ts - b.ts));
    })();
  }, [game, day, dataVersion]);
  const shown = onlyFlags ? logs.filter((l) => l.safety) : logs;
  return (
    <div className="p-section" data-testid="logs">
      <h2>💬 对话日志</h2>
      <div className="row gap">
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        <select value={day} onChange={(e) => setDay(e.target.value)}>
          {[day, ...days.filter((d) => d !== day)].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <label className="inline">
          <input type="checkbox" checked={onlyFlags} onChange={(e) => setOnlyFlags(e.target.checked)} /> 只看安全提醒 ⚠️
        </label>
        <span className="muted">{shown.length} 条</span>
      </div>
      <div className="log-list">
        {shown.map((l) => (
          <div key={l.id} className={`log-row ${l.role} ${l.safety ? 'flag' : ''}`}>
            <span className="log-time">{new Date(l.ts).toLocaleTimeString('zh-CN', { hour12: false })}</span>
            <span className="log-who">{l.role === 'child' ? '👧' : '⭐'}</span>
            <span className="log-mod">{l.module === 'forest' ? '🌳' : l.module === 'mission' ? `🚀${l.missionId ?? ''}` : '⚙️'}</span>
            <span className="log-text">
              {l.qtype && <span className="qbadge sm">{QTYPE_BADGES[l.qtype].icon} {QTYPE_BADGES[l.qtype].name.zh}</span>}
              {l.safety && <b className="flag-tag">⚠️ 安全</b>}
              {l.text}
              {l.mode && <small className="muted"> · {l.mode === 'llm' ? 'AI' : 'demo'}</small>}
            </span>
            {l.image && <img src={l.image} alt="" className="p-thumb sm" />}
          </div>
        ))}
        {shown.length === 0 && <p className="muted">这一天没有记录。</p>}
      </div>
    </div>
  );
}
