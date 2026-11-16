'use client';

import { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { Mentor, Say, T, TopBar } from '../ui';
import { sfx } from '@/lib/sfx';
import type { Redemption, Reward } from '@/lib/types';

export function Shop() {
  const { game, wallet, say, refresh, dataVersion } = useApp();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [reds, setReds] = useState<Redemption[]>([]);
  const [confirm, setConfirm] = useState<Reward | null>(null);
  useEffect(() => {
    void (async () => {
      setRewards(await game.rewards());
      setReds((await game.repo.redemptions.all()).sort((a, b) => b.ts - a.ts));
    })();
  }, [game, dataVersion]);
  useEffect(() => {
    void say({ zh: '这是奖励商店！星星够了就可以换奖励，爸爸妈妈确认后就能拿到哦。', en: 'This is the reward shop! Trade stars for rewards — your grown-ups will confirm.' });
  }, [say]);

  const request = async (r: Reward) => {
    try {
      await game.requestRedemption(r.id);
      sfx.fanfare();
      await refresh();
      setConfirm(null);
      void say({ zh: `好的！"${r.name}"的兑换请求已经发给爸爸妈妈啦！`, en: `Done! Your request for "${r.name}" was sent to your grown-ups!` }, { mood: 'clapping' });
    } catch {
      sfx.soft();
      setConfirm(null);
      void say({ zh: '星星还不够哦，再去攒一攒吧！', en: 'Not enough stars yet — keep collecting!' }, { mood: 'surprised' });
    }
  };

  const pending = reds.filter((r) => r.status === 'pending');
  return (
    <main className="screen shop">
      <TopBar title={{ zh: '奖励商店', en: 'Reward Shop' }} />
      <div className="album-body">
        <aside className="side-mentor">
          <Mentor size={170} />
          <div className="wallet-card">
            <div>
              ⭐ <b data-testid="shop-available">{wallet.available}</b>
            </div>
            {wallet.reserved > 0 && <small>⏳ {wallet.reserved}</small>}
          </div>
        </aside>
        <section className="shop-shelf">
          {rewards.length === 0 && <Say b={{ zh: '商店里还没有奖励，请爸爸妈妈在后台添加吧！', en: 'No rewards yet. Ask your grown-ups to add some!' }} big />}
          <div className="reward-grid" data-testid="reward-grid">
            {rewards.map((r) => {
              const can = wallet.available >= r.cost;
              const isPending = pending.some((x) => x.rewardId === r.id);
              return (
                <div key={r.id} className={`reward-card ${can ? 'can' : 'cannot'}`} data-testid={`reward-${r.id}`}>
                  <div className="reward-img">{r.image ? <img src={r.image} alt="" /> : <span>🎁</span>}</div>
                  <Say b={{ zh: r.name, en: r.name }} />
                  <div className="reward-cost">⭐ {r.cost}</div>
                  <div className="reward-progress">
                    <span style={{ width: `${Math.min(100, (wallet.available / r.cost) * 100)}%` }} />
                  </div>
                  <button
                    className="big-btn primary"
                    disabled={!can}
                    data-testid={`redeem-${r.id}`}
                    onClick={() => {
                      sfx.tap();
                      setConfirm(r);
                      void say({ zh: `要用 ${r.cost} 颗星换"${r.name}"吗？`, en: `Use ${r.cost} stars for "${r.name}"?` });
                    }}
                  >
                    {can ? '🛒' : `🔒 ${r.cost - wallet.available}`}
                  </button>
                  {isPending && <span className="pending-tag">⏳</span>}
                </div>
              );
            })}
          </div>
          {reds.length > 0 && (
            <div className="redeem-history">
              <h3>
                <T b={{ zh: '我的兑换', en: 'My requests' }} />
              </h3>
              {reds.slice(0, 8).map((r) => (
                <div key={r.id} className={`redeem-row st-${r.status}`} data-testid="redeem-row" data-status={r.status}>
                  <span>{r.status === 'pending' ? '⏳' : r.status === 'confirmed' ? '✅' : '↩️'}</span>
                  <span>{r.rewardName}</span>
                  <span>⭐{r.cost}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      {confirm && (
        <div className="modal" onClick={() => setConfirm(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="reward-img big">{confirm.image ? <img src={confirm.image} alt="" /> : <span>🎁</span>}</div>
            <Say b={{ zh: `用 ${confirm.cost} 颗星换"${confirm.name}"？`, en: `Use ${confirm.cost} stars for "${confirm.name}"?` }} big />
            <div className="row gap center">
              <button className="big-btn primary" data-testid="redeem-yes" onClick={() => void request(confirm)}>
                ✅
              </button>
              <button className="big-btn" onClick={() => (sfx.tap(), setConfirm(null))}>
                ✖️
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
