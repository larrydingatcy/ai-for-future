'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { useMissionCelebrations } from '../hooks';
import { Mentor, Stars, T, TopBar } from '../ui';
import { isMissionUnlocked, pickMission } from '@/lib/logic/missionPicker';
import { sfx } from '@/lib/sfx';
import type { Bi, Mission, MissionProgress, PendingBigStar } from '@/lib/types';

type Status = 'locked' | 'new' | 'active' | 'awaiting' | 'done';

export function Base() {
  const { game, go, say, speak, dataVersion } = useApp();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [bigs, setBigs] = useState<PendingBigStar[]>([]);
  const [progress, setProgress] = useState<MissionProgress[]>([]);
  const [rec, setRec] = useState<Mission | null>(null);
  const announced = useRef(false);
  useMissionCelebrations();

  useEffect(() => {
    void (async () => {
      const [ms, bs, ps] = await Promise.all([game.missions(), game.repo.bigStars.all(), game.repo.progress.all()]);
      setMissions(ms);
      setBigs(bs);
      setProgress(ps);
      const r = pickMission(ms, bs, ps);
      setRec(r);
      if (!announced.current) {
        announced.current = true;
        if (r) {
          const inProgress = ps.some((p) => p.missionId === r.id && p.status === 'active');
          void say({
            zh: `${inProgress ? '我们接着做' : '小星给你挑了一个任务'}：${r.title_zh}！${r.brief_zh}`,
            en: `${inProgress ? "Let's continue" : 'I picked a mission for you'}: ${r.title_en}! ${r.brief_en}`,
          });
        } else {
          void say({ zh: '现在的任务都做完啦，等爸爸妈妈确认后会解锁新任务哦！', en: 'All missions are done for now. New ones unlock after your grown-ups check!' });
        }
      }
    })();
  }, [game, say, dataVersion]);

  const done = new Set(bigs.filter((b) => b.status === 'confirmed').map((b) => b.missionId));
  const statusOf = (m: Mission): Status => {
    if (done.has(m.id)) return 'done';
    const p = progress.find((x) => x.missionId === m.id);
    if (p?.status === 'awaiting') return 'awaiting';
    if (!isMissionUnlocked(m, done)) return 'locked';
    return p ? 'active' : 'new';
  };

  return (
    <main className="screen base">
      <TopBar title={{ zh: '任务基地', en: 'Mission Base' }} />
      <div className="base-body">
        <aside className="base-mentor">
          <Mentor size={200} />
        </aside>
        <section className="mission-grid" data-testid="mission-grid">
          {missions.map((m) => {
            const st = statusOf(m);
            const big = bigs.find((b) => b.missionId === m.id && b.status === 'confirmed');
            const p = progress.find((x) => x.missionId === m.id);
            const title: Bi = { zh: m.title_zh, en: m.title_en };
            const needs = missions.filter((x) => m.unlock_requires.includes(x.id) && !done.has(x.id));
            return (
              <button
                key={m.id}
                className={`mission-card st-${st} ${rec?.id === m.id ? 'recommended' : ''}`}
                data-testid={`mission-${m.id}`}
                data-status={st}
                onClick={() => {
                  sfx.tap();
                  if (st === 'locked') {
                    sfx.soft();
                    void say(
                      {
                        zh: `先完成${needs.map((n) => `"${n.title_zh}"`).join('和')}，这个任务就会解锁！`,
                        en: `Finish ${needs.map((n) => `"${n.title_en}"`).join(' and ')} first to unlock this one!`,
                      },
                      { mood: 'surprised' },
                    );
                    return;
                  }
                  void speak(title);
                  go({ name: 'mission', id: m.id });
                }}
              >
                {rec?.id === m.id && (
                  <span className="rec-ribbon">
                    ⭐ <T b={{ zh: '小星推荐', en: 'Pick' }} />
                  </span>
                )}
                <span className="mission-icon">{st === 'locked' ? '🔒' : m.icon}</span>
                <T b={title} className="mission-title" />
                <span className="mission-meta">
                  <span className="difficulty" title="difficulty">
                    {'🔥'.repeat(m.difficulty)}
                  </span>
                  <span>⏱️{m.est_minutes}′</span>
                </span>
                <span className="mission-status">
                  {st === 'done' && big && (
                    <>
                      🏆 <Stars n={big.finalStars ?? big.stars} size={20} />
                    </>
                  )}
                  {st === 'awaiting' && <>🎁 ⏳</>}
                  {st === 'active' && p && <StepDots step={p.step} />}
                  {st === 'new' && <span className="new-chip">NEW</span>}
                </span>
              </button>
            );
          })}
        </section>
      </div>
    </main>
  );
}

export function StepDots({ step }: { step: number }) {
  return (
    <span className="step-dots">
      {[1, 2, 3, 4].map((i) => (
        <i key={i} className={i < step ? 'on' : i === step ? 'cur' : ''} />
      ))}
    </span>
  );
}
