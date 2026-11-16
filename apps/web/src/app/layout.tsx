import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bàn Chơi Trực Tuyến — Boardgame Việt',
  description: 'Nền tảng chơi bài và boardgame nhiều người chơi trực tuyến',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
