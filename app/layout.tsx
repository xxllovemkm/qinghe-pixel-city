import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'青河市 · 像素沙盒世界',description:'探索一座持续运转的像素城市：居民社区、四类学校、河流桥梁与城市地标。拖动、缩放，并建造你自己的街区。',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>;}
