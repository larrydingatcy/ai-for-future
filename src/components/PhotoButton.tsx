'use client';

import { useRef, useState } from 'react';
import { useApp } from './AppContext';
import { T } from './ui';
import { fileToDataUrl } from '@/lib/image';
import { sfx } from '@/lib/sfx';
import type { Bi } from '@/lib/types';

const DEFAULT_LABEL: Bi = { zh: '拍照', en: 'Take a photo' };

/** Big camera button. Opens the iPad camera (or photo picker); photo is downscaled to ≤1024 px. */
export function PhotoButton({
  onPhoto,
  label = DEFAULT_LABEL,
  testId = 'photo',
  disabled,
  icon = '📷',
}: {
  onPhoto: (dataUrl: string) => void | Promise<void>;
  label?: Bi;
  testId?: string;
  disabled?: boolean;
  icon?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { say, speak } = useApp();
  return (
    <div className="photo-wrap">
      <button
        className={`photo-btn ${busy ? 'processing' : ''}`}
        disabled={disabled || busy}
        data-testid={`${testId}-btn`}
        onClick={() => {
          sfx.tap();
          void speak(label);
          ref.current?.click();
        }}
      >
        <span className="photo-icon">{icon}</span>
        <T b={label} className="photo-label" />
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        data-testid={`${testId}-input`}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setBusy(true);
          sfx.camera();
          try {
            const url = await fileToDataUrl(f, 1024);
            await onPhoto(url);
          } catch {
            void say({ zh: '这张照片打不开，再拍一张试试？', en: "That photo didn't open. Try another one?" }, { mood: 'surprised' });
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
