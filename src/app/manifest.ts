import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AI for Future · 未来小创想家',
    short_name: 'AI for Future',
    description: '儿童 AI 学习游戏：好奇森林 + 任务基地',
    start_url: `${BASE}/`,
    scope: `${BASE}/`,
    display: 'standalone',
    orientation: 'landscape',
    background_color: '#FFF7E0',
    theme_color: '#7C5CFF',
    lang: 'zh-CN',
    icons: [
      { src: `${BASE}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${BASE}/icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
      { src: `${BASE}/icons/icon-512-maskable.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
