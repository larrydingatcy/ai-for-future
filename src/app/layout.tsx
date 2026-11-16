import type { Metadata, Viewport } from 'next';
import './globals.css';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const metadata: Metadata = {
  title: 'AI for Future · 未来小创想家',
  description: '帮 5 岁孩子学会使用 AI、探索世界、培养解决问题能力的双语学习游戏。',
  manifest: `${BASE}/manifest.webmanifest`,
  icons: {
    icon: [{ url: `${BASE}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' }],
    apple: [{ url: `${BASE}/icons/apple-touch-icon.png`, sizes: '180x180' }],
  },
  appleWebApp: { capable: true, title: 'AI for Future', statusBarStyle: 'black-translucent' },
  other: { 'mobile-web-app-capable': 'yes' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#7C5CFF',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
