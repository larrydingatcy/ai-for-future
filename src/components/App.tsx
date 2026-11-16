'use client';

import { useEffect } from 'react';
import { AppProvider, useApp } from './AppContext';
import { CelebrationOverlay, StarBursts, TimeLock } from './Overlays';
import { Splash } from './screens/Splash';
import { Home } from './screens/Home';
import { Forest } from './screens/Forest';
import { Base } from './screens/Base';
import { MissionScreen } from './screens/Mission';
import { Album } from './screens/Album';
import { Badges } from './screens/Badges';
import { Shop } from './screens/Shop';
import { ParentApp } from './parent/ParentApp';
import { BASE_PATH } from '@/lib/util';

function Screens() {
  const { view } = useApp();
  switch (view.name) {
    case 'splash':
      return <Splash />;
    case 'home':
      return <Home />;
    case 'forest':
      return <Forest />;
    case 'base':
      return <Base />;
    case 'mission':
      return <MissionScreen key={view.id} id={view.id} />;
    case 'album':
      return <Album />;
    case 'badges':
      return <Badges />;
    case 'shop':
      return <Shop />;
    case 'parent':
      return <ParentApp />;
  }
}

function Shell() {
  const { view } = useApp();
  return (
    <div className="app" data-view={view.name}>
      <Screens />
      {view.name !== 'parent' && <StarBursts />}
      {view.name !== 'parent' && <CelebrationOverlay />}
      {view.name !== 'parent' && view.name !== 'splash' && <TimeLock />}
    </div>
  );
}

export default function App() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` }).catch(() => {});
  }, []);
  // Stop iOS double-tap zoom / long-press callouts on the kid UI.
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', prevent);
    return () => document.removeEventListener('gesturestart', prevent);
  }, []);
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
