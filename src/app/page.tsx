'use client';

import dynamic from 'next/dynamic';

// The whole game is client-side (IndexedDB, speech, camera), so skip server rendering.
const App = dynamic(() => import('@/components/App'), {
  ssr: false,
  loading: () => (
    <div className="boot">
      <span>⭐</span>
    </div>
  ),
});

export default function Page() {
  return <App />;
}
