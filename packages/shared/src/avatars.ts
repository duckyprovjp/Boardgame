export interface AvatarOption {
  id: string;
  label: string;
  emoji: string;
  bgClass: string;
}

export const AVATARS: readonly AvatarOption[] = [
  { id: 'fox', label: 'Cáo Lửa', emoji: '🦊', bgClass: 'bg-orange-500/20' },
  { id: 'cat', label: 'Mèo Mướp', emoji: '🐱', bgClass: 'bg-amber-500/20' },
  { id: 'owl', label: 'Cú Đêm', emoji: '🦉', bgClass: 'bg-indigo-500/20' },
  { id: 'bear', label: 'Gấu Nâu', emoji: '🐻', bgClass: 'bg-yellow-700/20' },
  { id: 'frog', label: 'Ếch Xanh', emoji: '🐸', bgClass: 'bg-emerald-500/20' },
  { id: 'panda', label: 'Gấu Trúc', emoji: '🐼', bgClass: 'bg-slate-500/20' },
  { id: 'rabbit', label: 'Thỏ Ngọc', emoji: '🐰', bgClass: 'bg-pink-500/20' },
  { id: 'dragon', label: 'Rồng Con', emoji: '🐲', bgClass: 'bg-teal-500/20' },
  { id: 'tiger', label: 'Hổ Vằn', emoji: '🐯', bgClass: 'bg-orange-600/20' },
  { id: 'penguin', label: 'Cánh Cụt', emoji: '🐧', bgClass: 'bg-sky-500/20' },
] as const;

export const AVATAR_IDS = AVATARS.map((a) => a.id) as [string, ...string[]];

export function getAvatarById(id: string): AvatarOption {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0]!;
}
