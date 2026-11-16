'use client';

import { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { Mentor, Say, T, TopBar } from '../ui';
import { SOURCES } from './Mission';
import type { InfoCard, Mission } from '@/lib/types';

export function Album() {
  const { game, say, dataVersion } = useApp();
  const [cards, setCards] = useState<InfoCard[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [open, setOpen] = useState<InfoCard | null>(null);
  useEffect(() => {
    void (async () => {
      const cs = (await game.repo.cards.all()).sort((a, b) => b.ts - a.ts);
      setCards(cs);
      setMissions(await game.missions({ includeDisabled: true }));
      void say(
        cs.length
          ? { zh: `你已经收集了 ${cs.length} 张信息卡！点一张看看吧。`, en: `You have collected ${cs.length} info cards! Tap one to look.` }
          : { zh: '收藏册还是空的。去任务基地收集信息卡吧！', en: 'Your album is empty. Go to Mission Base to collect info cards!' },
      );
    })();
  }, [game, say, dataVersion]);

  const groups = missions.map((m) => ({ m, cs: cards.filter((c) => c.missionId === m.id) })).filter((g) => g.cs.length);

  return (
    <main className="screen album">
      <TopBar title={{ zh: '信息卡收藏册', en: 'Info Card Album' }} />
      <div className="album-body">
        <aside className="side-mentor">
          <Mentor size={170} />
        </aside>
        <section className="album-pages" data-testid="album">
          {groups.length === 0 && <div className="empty-art">📒✨</div>}
          {groups.map(({ m, cs }) => (
            <div key={m.id} className="album-group">
              <div className="album-group-title">
                <span>{m.icon}</span> <T b={{ zh: m.title_zh, en: m.title_en }} />
              </div>
              <div className="album-grid">
                {cs.map((c) => (
                  <button key={c.id} className="album-card" style={{ ['--tile' as string]: SOURCES[c.source].color }} onClick={() => setOpen(c)} data-testid="album-card">
                    <span className="info-src">{SOURCES[c.source].icon}</span>
                    {c.image ? <img src={c.image} alt="" /> : <span className="album-card-art">{SOURCES[c.source].icon}</span>}
                    <span className="info-text">{c.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
      {open && (
        <div className="modal" onClick={() => setOpen(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="source-head">
              <span className="source-icon">{SOURCES[open.source].icon}</span>
              <T b={SOURCES[open.source].name} />
            </div>
            {open.image && <img src={open.image} alt="" className="preview big" />}
            <Say b={{ zh: open.text, en: open.text }} big />
            <button className="big-btn" onClick={() => setOpen(null)}>
              ✖️
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
