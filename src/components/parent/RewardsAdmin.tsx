'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { fileToDataUrl } from '@/lib/image';
import type { Redemption, Reward } from '@/lib/types';

const fmt = (ts?: number) => (ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '');
const STATUS = { pending: '⏳ 待确认', confirmed: '✅ 已兑换', rejected: '✖️ 已拒绝' } as const;

export function RewardsAdmin() {
  const { game, refresh, dataVersion } = useApp();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [reds, setReds] = useState<Redemption[]>([]);
  const [form, setForm] = useState<{ id?: string; name: string; cost: number; image?: string; active: boolean }>({ name: '', cost: 10, active: true });
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void (async () => {
      setRewards(await game.rewards(true));
      setReds((await game.repo.redemptions.all()).sort((a, b) => b.ts - a.ts));
    })();
  }, [game, dataVersion]);

  const save = async () => {
    try {
      await game.saveReward({ ...form, cost: Number(form.cost) });
      setForm({ name: '', cost: 10, active: true });
      setErr('');
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="p-section">
      <h2>🎁 奖励商店</h2>
      <div className="p-card p-form" data-testid="reward-form">
        <label>
          名称
          <input data-testid="reward-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例如：周末去公园" />
        </label>
        <label>
          所需星数
          <input data-testid="reward-cost" type="number" min={1} value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} />
        </label>
        <label>
          图片
          <div className="row gap">
            {form.image && <img src={form.image} alt="" className="p-thumb sm" />}
            <button className="p-btn" onClick={() => fileRef.current?.click()}>
              选择图片
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setForm({ ...form, image: await fileToDataUrl(f, 512) });
            }} />
          </div>
        </label>
        <label className="inline">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> 上架
        </label>
        <div className="row gap">
          <button className="p-btn primary" data-testid="reward-save" onClick={save}>
            {form.id ? '保存修改' : '➕ 添加奖励'}
          </button>
          {form.id && (
            <button className="p-btn" onClick={() => setForm({ name: '', cost: 10, active: true })}>
              取消
            </button>
          )}
        </div>
        {err && <div className="p-error">{err}</div>}
      </div>

      <div className="p-list">
        {rewards.map((r) => (
          <div key={r.id} className={`p-card ${r.active ? '' : 'dim'}`}>
            {r.image ? <img src={r.image} alt="" className="p-thumb sm" /> : <span className="p-emoji">🎁</span>}
            <div className="p-card-main">
              <h3>
                {r.name} · ⭐{r.cost} {!r.active && <small>（已下架）</small>}
              </h3>
            </div>
            <button className="p-btn" onClick={() => setForm({ id: r.id, name: r.name, cost: r.cost, image: r.image, active: r.active })}>
              编辑
            </button>
            <button className="p-btn danger" onClick={async () => { if (confirm(`删除"${r.name}"？`)) { await game.deleteReward(r.id); await refresh(); } }}>
              删除
            </button>
          </div>
        ))}
      </div>

      <h2>🧾 兑换记录</h2>
      <table className="p-table" data-testid="redeem-history">
        <thead>
          <tr>
            <th>时间</th>
            <th>奖励</th>
            <th>星数</th>
            <th>状态</th>
            <th>处理时间</th>
          </tr>
        </thead>
        <tbody>
          {reds.map((r) => (
            <tr key={r.id}>
              <td>{fmt(r.ts)}</td>
              <td>{r.rewardName}</td>
              <td>{r.cost}</td>
              <td>{STATUS[r.status]}</td>
              <td>{fmt(r.resolvedTs)}</td>
            </tr>
          ))}
          {reds.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                暂无记录
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
