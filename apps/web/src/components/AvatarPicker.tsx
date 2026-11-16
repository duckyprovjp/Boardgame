'use client';

import { AVATARS } from '@boardgame/shared';

interface AvatarPickerProps {
  value: string;
  onChange: (avatarId: string) => void;
}

export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {AVATARS.map((avatar) => {
        const selected = avatar.id === value;
        return (
          <button
            key={avatar.id}
            type="button"
            onClick={() => onChange(avatar.id)}
            title={avatar.label}
            aria-label={avatar.label}
            aria-pressed={selected}
            className={`flex flex-col items-center justify-center rounded-xl border p-2 transition ${
              selected
                ? 'border-emerald-400 bg-emerald-500/20 ring-2 ring-emerald-400/50'
                : 'border-slate-800 bg-slate-950/60 hover:border-slate-600'
            }`}
          >
            <span className="text-2xl leading-none">{avatar.emoji}</span>
            <span className="mt-1 truncate text-[10px] text-slate-300">{avatar.label}</span>
          </button>
        );
      })}
    </div>
  );
}
