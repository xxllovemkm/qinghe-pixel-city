import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '青河市 · 3D 体素沙盒世界',
  description:
    '旋转视角，探索一座持续运转的立体像素城市：居民社区、四类学校、河流桥梁与城市地标。旋转、平移、缩放，并建造你自己的街区。',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
