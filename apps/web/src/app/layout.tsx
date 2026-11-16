import type { Metadata } from 'next';
import { AppProvider } from '@/components/AppProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bàn Chơi Trực Tuyến — Boardgame Việt',
  description: 'Nền tảng chơi Bài Sắc Màu và Xúc Xắc Định Mệnh nhiều người chơi trực tuyến',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
