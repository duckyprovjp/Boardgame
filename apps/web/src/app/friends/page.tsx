'use client';

import { useApp } from '@/components/AppProvider';
import { FriendsPanel } from '@/components/FriendsPanel';

export default function FriendsPage() {
  const { user, loadingAuth, socket } = useApp();

  if (loadingAuth || !user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-center text-sm text-slate-400">
        Đang tải danh sách bạn bè...
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <FriendsPanel socket={socket} />
    </main>
  );
}
