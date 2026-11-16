'use client';

import { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { MISSION_TEMPLATE, generateMission, normalizeMission, validateMission } from '@/lib/ai/mentor';
import { PRESET_MISSIONS } from '@/lib/services/game';
import type { CustomMission, Mission } from '@/lib/types';

type Editing = { json: string; base?: CustomMission; isPreset: boolean } | null;

export function MissionsAdmin() {
  const { game, mentor, mode, refresh, dataVersion } = useApp();
  const [all, setAll] = useState<Mission[]>([]);
  const [custom, setCustom] = useState<CustomMission[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [err, setErr] = useState('');
  const [theme, setTheme] = useState('');
  const [diff, setDiff] = useState(1);
  const [gen, setGen] = useState(false);
  useEffect(() => {
    void (async () => {
      setAll(await game.missions({ includeDisabled: true }));
      setCustom(await game.repo.missions.all());
    })();
  }, [game, dataVersion]);

  const isPreset = (id: string) => PRESET_MISSIONS.some((p) => p.id === id);
  const customOf = (id: string) => custom.find((c) => c.id === id);
  const enabled = (id: string) => customOf(id)?.status !== 'approved' || customOf(id)?.enabled !== false;
  const pending = custom.filter((c) => c.status === 'pending');

  const toggle = async (m: Mission) => {
    const c = customOf(m.id);
    const on = !enabled(m.id);
    await game.saveCustomMission({ ...m, ...(c ?? {}), source: c?.source ?? 'preset-edit', status: 'approved', enabled: on, createdTs: c?.createdTs ?? Date.now() });
    await refresh();
  };

  const saveEdit = async (approve: boolean) => {
    if (!editing) return;
    try {
      const j = JSON.parse(editing.json);
      const m = normalizeMission(j, editing.base?.id);
      const errs = validateMission(m);
      if (errs.length) throw new Error(`缺少字段：${errs.join(', ')}`);
      const base = editing.base;
      await game.saveCustomMission({
        ...m,
        source: base?.source ?? (editing.isPreset ? 'preset-edit' : 'parent'),
        status: approve ? 'approved' : (base?.status ?? 'approved'),
        enabled: approve ? true : (base?.enabled ?? true),
        createdTs: base?.createdTs ?? Date.now(),
      });
      setEditing(null);
      setErr('');
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const generate = async () => {
    setGen(true);
    setErr('');
    try {
      const { mission, mode: used } = await generateMission(mentor(), theme, diff);
      await game.saveCustomMission({ ...mission, source: 'ai', status: 'pending', enabled: false, createdTs: Date.now() });
      if (used === 'demo') setErr('当前为演示模式：已用模板生成草稿，请编辑后再批准。');
      await refresh();
    } finally {
      setGen(false);
    }
  };

  return (
    <div className="p-section" data-testid="missions-admin">
      <h2>🧩 任务库</h2>
      <p className="muted">
        预置任务来自 <code>content/missions.json</code>（改 JSON 后重新部署即可）。这里的修改、新增只保存在这台设备上。
      </p>
      {err && <div className="p-banner warn">{err}</div>}

      <div className="p-card p-form">
        <h3>🤖 让 AI 按模板生成新任务（需审核）</h3>
        <div className="row gap">
          <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="主题，例如：给小金鱼做一个家" />
          <select value={diff} onChange={(e) => setDiff(Number(e.target.value))}>
            <option value={1}>难度 1</option>
            <option value={2}>难度 2</option>
            <option value={3}>难度 3</option>
          </select>
          <button className="p-btn primary" data-testid="gen-mission" disabled={gen} onClick={generate}>
            {gen ? '生成中…' : '生成'}
          </button>
          <span className="muted">{mode === 'llm' ? '使用 AI 模型' : '演示模式（模板草稿）'}</span>
        </div>
        <button
          className="p-btn"
          onClick={() => setEditing({ json: MISSION_TEMPLATE.replace('"kebab-case-id"', `"m-${Date.now().toString(36)}"`), isPreset: false })}
        >
          ✍️ 手动新建任务
        </button>
      </div>

      {pending.length > 0 && (
        <>
          <h3>⏳ 待审核（{pending.length}）</h3>
          {pending.map((c) => (
            <div key={c.id} className="p-card" data-testid="pending-mission">
              <span className="p-emoji">{c.icon}</span>
              <div className="p-card-main">
                <h3>
                  {c.title_zh} <small>{c.title_en}</small>
                </h3>
                <p>{c.brief_zh}</p>
                <p className="muted">{c.brief_en}</p>
              </div>
              <button className="p-btn" onClick={() => setEditing({ json: JSON.stringify(strip(c), null, 2), base: c, isPreset: false })}>
                编辑
              </button>
              <button className="p-btn primary" data-testid="approve-mission" onClick={async () => (await game.reviewCustomMission(c.id, true), await refresh())}>
                ✅ 批准
              </button>
              <button className="p-btn danger" onClick={async () => (await game.reviewCustomMission(c.id, false), await refresh())}>
                ✖️ 拒绝
              </button>
            </div>
          ))}
        </>
      )}

      <h3>📚 全部任务</h3>
      {all.map((m) => (
        <div key={m.id} className={`p-card ${enabled(m.id) ? '' : 'dim'}`}>
          <span className="p-emoji">{m.icon}</span>
          <div className="p-card-main">
            <h3>
              {m.title_zh} <small>{m.title_en}</small> {isPreset(m.id) ? <span className="tag">预置</span> : <span className="tag">自定义</span>}
            </h3>
            <p className="muted">
              难度 {m.difficulty} · 约 {m.est_minutes} 分钟 · 解锁条件：{m.unlock_requires.join(', ') || '无'}
            </p>
          </div>
          <label className="inline">
            <input type="checkbox" checked={enabled(m.id)} onChange={() => toggle(m)} /> 启用
          </label>
          <button className="p-btn" onClick={() => setEditing({ json: JSON.stringify(strip(m), null, 2), base: customOf(m.id), isPreset: isPreset(m.id) })}>
            编辑
          </button>
        </div>
      ))}

      {editing && (
        <div className="modal" onClick={() => setEditing(null)}>
          <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
            <h3>编辑任务 JSON</h3>
            <textarea className="json-editor" value={editing.json} onChange={(e) => setEditing({ ...editing, json: e.target.value })} spellCheck={false} />
            {err && <div className="p-error">{err}</div>}
            <div className="row gap">
              <button className="p-btn primary" onClick={() => saveEdit(true)}>
                保存并启用
              </button>
              {editing.base?.status === 'pending' && (
                <button className="p-btn" onClick={() => saveEdit(false)}>
                  仅保存草稿
                </button>
              )}
              <button className="p-btn" onClick={() => setEditing(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function strip(m: Mission | CustomMission): Mission {
  const { source: _a, status: _b, enabled: _c, createdTs: _d, ...rest } = m as CustomMission;
  return rest;
}
