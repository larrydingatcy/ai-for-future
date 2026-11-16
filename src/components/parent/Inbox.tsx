'use client';

import { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { pick } from '@/lib/i18n';
import type { Mission, PendingBigStar, Redemption } from '@/lib/types';

const fmt = (ts: number) => new Date(ts).toLocaleString('zh-CN', { hour12: false });

export function Inbox() {
  const { game, refresh, dataVersion, wallet, remainingSec, settings } = useApp();
  const [bigs, setBigs] = useState<PendingBigStar[]>([]);
  const [reds, setReds] = useState<Redemption[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [adjust, setAdjust] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState('');
  useEffect(() => {
    void (async () => {
      setBigs((await game.repo.bigStars.where('status', 'pending')).sort((a, b) => a.ts - b.ts));
      setReds((await game.repo.redemptions.where('status', 'pending')).sort((a, b) => a.ts - b.ts));
      setMissions(await game.missions({ includeDisabled: true }));
    })();
  }, [game, dataVersion]);

  const run = async (f: () => Promise<unknown>, ok: string) => {
    try {
      await f();
      setMsg(`✅ ${ok}`);
    } catch (e) {
      setMsg(`⚠️ ${e instanceof Error ? e.message : e}`);
    }
    await refresh();
  };

  return (
    <div className="p-section" data-testid="inbox">
      <div className="p-stats">
        <div>
          <b>{wallet.balance}</b>
          <small>可用星星</small>
        </div>
        <div>
          <b>{wallet.totalEarned}</b>
          <small>累计获得</small>
        </div>
        <div>
          <b>{wallet.pendingBig}</b>
          <small>待确认大星</small>
        </div>
        <div>
          <b>{Math.max(0, Math.round(remainingSec / 60))}′</b>
          <small>今日剩余 / {settings.dailyLimitMin}′</small>
        </div>
      </div>
      {msg && <div className="p-banner">{msg}</div>}

      <h2>🏆 待确认通关（{bigs.length}）</h2>
      {bigs.length === 0 && <p className="muted">暂无。孩子完成任务第 4 步后，通关大星会出现在这里。</p>}
      {bigs.map((b) => {
        const m = missions.find((x) => x.id === b.missionId);
        const stars = adjust[b.id] ?? b.stars;
        return (
          <div key={b.id} className="p-card" data-testid="pending-big">
            {b.resultImage && <img src={b.resultImage} alt="" className="p-thumb" />}
            <div className="p-card-main">
              <h3>
                {m?.icon} {m?.title_zh} <small>{m?.title_en}</small>
              </h3>
              <p>小星建议：{'⭐'.repeat(b.stars)}（{b.stars}）· {fmt(b.ts)}</p>
              <p className="muted">{pick(b.praise, 'both')}</p>
              <p className="muted">💡 {pick(b.suggestion, 'both')}</p>
              <div className="row gap">
                <label>
                  确认星数：
                  <select value={stars} onChange={(e) => setAdjust({ ...adjust, [b.id]: Number(e.target.value) })}>
                    {[1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n} ⭐
                      </option>
                    ))}
                  </select>
                </label>
                <button className="p-btn primary" data-testid="confirm-big" onClick={() => run(() => game.confirmBigStar(b.id, stars), `已确认 ${stars} 颗大星，下一个任务已解锁`)}>
                  ✅ 确认入账
                </button>
                <button className="p-btn" onClick={() => run(() => game.rejectBigStar(b.id), '已退回，孩子可以重做第 4 步')}>
                  ↩️ 退回重做
                </button>
              </div>
            </div>
          </div>
        );
      })}

      <h2>🎁 待确认兑换（{reds.length}）</h2>
      {reds.length === 0 && <p className="muted">暂无兑换请求。</p>}
      {reds.map((r) => (
        <div key={r.id} className="p-card" data-testid="pending-redeem">
          <div className="p-card-main">
            <h3>
              {r.rewardName} · ⭐{r.cost}
            </h3>
            <p className="muted">
              {fmt(r.ts)} · 当前余额 {wallet.balance}
            </p>
            <div className="row gap">
              <button className="p-btn primary" data-testid="confirm-redeem" disabled={wallet.balance < r.cost} onClick={() => run(() => game.confirmRedemption(r.id), `已兑换并扣除 ${r.cost} 颗星`)}>
                ✅ 确认并扣星
              </button>
              <button className="p-btn" onClick={() => run(() => game.rejectRedemption(r.id), '已拒绝，星星未扣除')}>
                ✖️ 拒绝
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
