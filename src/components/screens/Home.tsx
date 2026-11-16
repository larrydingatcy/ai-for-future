'use client';

import { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { useMissionCelebrations } from '../hooks';
import { Mentor, Tile, TopBar } from '../ui';

export function Home() {
  const { go, game, dataVersion } = useApp();
  const [pendingRedeem, setPendingRedeem] = useState(0);
  const [cards, setCards] = useState(0);
  const [streak, setStreak] = useState(0);
  useMissionCelebrations();
  useEffect(() => {
    void (async () => {
      setPendingRedeem((await game.repo.redemptions.where('status', 'pending')).length);
      setCards((await game.repo.cards.all()).length);
      setStreak((await game.profile()).streak);
    })();
  }, [game, dataVersion]);

  return (
    <main className="screen home">
      <TopBar back={false} extra={streak > 0 ? <div className="streak-chip">🔥 {streak}</div> : undefined} />
      <div className="home-body">
        <div className="home-mentor">
          <Mentor size={250} />
        </div>
        <div className="home-doors">
          <Tile
            size="xl"
            icon={<span className="door-art forest-art">🌳🦉🍄</span>}
            label={{ zh: '好奇森林', en: 'Curious Forest' }}
            color="linear-gradient(160deg,#7EE08A,#2FA66A)"
            testId="go-forest"
            onClick={() => go({ name: 'forest' })}
          />
          <Tile
            size="xl"
            icon={<span className="door-art base-art">🚀🛠️🧩</span>}
            label={{ zh: '任务基地', en: 'Mission Base' }}
            color="linear-gradient(160deg,#A68BFF,#5B5BF0)"
            testId="go-base"
            onClick={() => go({ name: 'base' })}
          />
          <div className="home-small">
            <Tile icon="📒" label={{ zh: '收藏册', en: 'Card Album' }} color="#FFB86B" testId="go-album" onClick={() => go({ name: 'album' })} badge={cards || undefined} />
            <Tile icon="🏅" label={{ zh: '徽章墙', en: 'Badges' }} color="#FF8FB1" testId="go-badges" onClick={() => go({ name: 'badges' })} />
            <Tile
              icon="🎁"
              label={{ zh: '奖励商店', en: 'Reward Shop' }}
              color="#5CC8FF"
              testId="go-shop"
              onClick={() => go({ name: 'shop' })}
              badge={pendingRedeem ? '⏳' : undefined}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
