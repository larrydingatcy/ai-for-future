'use client';

import { useEffect, useRef } from 'react';
import { useApp } from './AppContext';
import { isMissionUnlocked } from '@/lib/logic/missionPicker';

/** After a parent confirms a mission, the child sees the big celebration on her next screen. */
export function useMissionCelebrations() {
  const { game, celebrate, celebration, ready, dataVersion, refresh } = useApp();
  const busy = useRef(false);
  useEffect(() => {
    if (!ready || celebration || busy.current) return;
    busy.current = true;
    (async () => {
      try {
        const list = await game.uncelebrated();
        const b = list[0];
        if (!b) return;
        const missions = await game.missions();
        const m = missions.find((x) => x.id === b.missionId);
        const done = await game.completedMissionIds();
        const before = new Set([...done].filter((id) => id !== b.missionId));
        const unlocked = missions.filter((x) => !before.has(x.id) && !isMissionUnlocked(x, before) && isMissionUnlocked(x, done));
        await game.markCelebrated(b.id);
        const stars = b.finalStars ?? b.stars;
        celebrate({
          icon: m?.icon ?? '🏆',
          title: { zh: `通关啦！"${m?.title_zh ?? ''}"得到 ${stars} 颗大星！`, en: `Mission complete! "${m?.title_en ?? ''}" earned ${stars} big stars!` },
          subtitle: unlocked.length
            ? {
                zh: `解锁新任务：${unlocked.map((u) => `${u.icon}${u.title_zh}`).join('、')}`,
                en: `New mission unlocked: ${unlocked.map((u) => `${u.icon} ${u.title_en}`).join(', ')}`,
              }
            : undefined,
          stars,
        });
        await refresh();
      } finally {
        busy.current = false;
      }
    })();
  }, [game, celebrate, celebration, ready, dataVersion, refresh]);
}
