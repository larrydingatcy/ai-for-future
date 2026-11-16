'use client';

import { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { Mentor, T, TopBar } from '../ui';
import { QTYPE_BADGES } from '@/lib/logic/questionClassifier';
import { currentLevelIndex } from '@/lib/logic/forestLevels';
import { sfx } from '@/lib/sfx';
import type { Bi, ForestProgress, Mission, PendingBigStar, Profile, QuestionType } from '@/lib/types';

interface BadgeView {
  key: string;
  icon: string;
  name: Bi;
  earned: boolean;
  count?: number;
  how: Bi;
}

export function Badges() {
  const { game, speak, say, dataVersion } = useApp();
  const [forest, setForest] = useState<ForestProgress | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [bigs, setBigs] = useState<PendingBigStar[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    void (async () => {
      setForest(await game.forest());
      setMissions(await game.missions({ includeDisabled: true }));
      setBigs(await game.repo.bigStars.all());
      setProfile(await game.profile());
    })();
  }, [game, dataVersion]);
  useEffect(() => {
    void say({ zh: '这是你的徽章墙！亮起来的是你已经得到的。', en: 'This is your badge wall! The shiny ones are yours.' });
  }, [say]);
  if (!forest || !profile) return <main className="screen badges" />;

  const qBadges: BadgeView[] = (Object.keys(QTYPE_BADGES) as QuestionType[]).map((k) => ({
    key: `q-${k}`,
    icon: QTYPE_BADGES[k].icon,
    name: QTYPE_BADGES[k].name,
    earned: forest.typeCounts[k] > 0,
    count: forest.typeCounts[k],
    how: { zh: `问一个"${QTYPE_BADGES[k].name.zh}"的问题`, en: `Ask a "${QTYPE_BADGES[k].name.en}" question` },
  }));
  const cur = currentLevelIndex(game.forestLevels, forest);
  const lBadges: BadgeView[] = game.forestLevels.map((l, i) => ({
    key: l.id,
    icon: l.icon,
    name: { zh: l.title_zh, en: l.title_en },
    earned: i < cur,
    how: { zh: l.goal_zh, en: l.goal_en },
  }));
  const done = new Set(bigs.filter((b) => b.status === 'confirmed').map((b) => b.missionId));
  const mBadges: BadgeView[] = missions.map((m) => ({
    key: m.id,
    icon: m.icon,
    name: { zh: m.title_zh, en: m.title_en },
    earned: done.has(m.id),
    how: { zh: `完成任务"${m.title_zh}"`, en: `Finish "${m.title_en}"` },
  }));
  const sBadges: BadgeView[] = [
    { key: 's3', icon: '🔥', name: { zh: '连续 3 天', en: '3-day streak' }, earned: profile.bestStreak >= 3, how: { zh: '连续 3 天来玩', en: 'Play 3 days in a row' } },
    { key: 's7', icon: '🌟', name: { zh: '连续 7 天', en: '7-day streak' }, earned: profile.bestStreak >= 7, how: { zh: '连续 7 天来玩', en: 'Play 7 days in a row' } },
  ];

  const section = (title: Bi, list: BadgeView[]) => (
    <div className="badge-section">
      <h3>
        <T b={title} />
      </h3>
      <div className="badge-grid">
        {list.map((b) => (
          <button
            key={b.key}
            className={`badge ${b.earned ? 'earned' : 'locked'}`}
            data-testid={`badge-${b.key}`}
            data-earned={b.earned}
            onClick={() => {
              sfx.tap();
              void speak(b.earned ? b.name : { zh: `还没得到。${b.how.zh}就能得到哦！`, en: `Not yet. ${b.how.en} to earn it!` });
            }}
          >
            <span className="badge-medal">{b.earned ? b.icon : '❔'}</span>
            <T b={b.name} className="badge-name" />
            {!!b.count && <span className="badge-count">×{b.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <main className="screen badges">
      <TopBar title={{ zh: '徽章墙', en: 'Badge Wall' }} />
      <div className="album-body">
        <aside className="side-mentor">
          <Mentor size={170} />
        </aside>
        <section className="badge-wall">
          {section({ zh: '提问徽章', en: 'Question badges' }, qBadges)}
          {section({ zh: '森林关卡', en: 'Forest levels' }, lBadges)}
          {section({ zh: '任务徽章', en: 'Mission badges' }, mBadges)}
          {section({ zh: '打卡徽章', en: 'Streak badges' }, sBadges)}
        </section>
      </div>
    </main>
  );
}
