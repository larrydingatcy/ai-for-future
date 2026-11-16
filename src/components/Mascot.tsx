'use client';

import type { MascotMood } from '@/lib/types';

function starPath(cx: number, cy: number, R: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

const BODY = starPath(100, 112, 80, 44);

/** 小星 — a chubby yellow star. Mood changes face, extras and the CSS animation. */
export function Mascot({ mood = 'happy', size = 220 }: { mood?: MascotMood; size?: number }) {
  const closedEyes = mood === 'clapping' || mood === 'sleepy';
  const lookUp = mood === 'thinking';
  return (
    <div className={`mascot mascot-${mood}`} style={{ width: size, height: size }} data-testid="mascot" data-mood={mood}>
      <svg viewBox="0 0 200 200" width={size} height={size} aria-label="小星 Xiaoxing">
        <defs>
          <radialGradient id="ms-body" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#FFF3A6" />
            <stop offset="55%" stopColor="#FFD84D" />
            <stop offset="100%" stopColor="#FFB627" />
          </radialGradient>
        </defs>

        {/* sparkles around */}
        <g className="ms-sparkles">
          <path d="M28 40 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" fill="#FFE98A" />
          <path d="M172 34 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#B9F3FF" />
          <path d="M176 150 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#FFC6E5" />
        </g>

        <g className="ms-body">
          <path d={BODY} fill="#F29E00" stroke="#F29E00" strokeWidth="26" strokeLinejoin="round" />
          <path d={BODY} fill="url(#ms-body)" stroke="url(#ms-body)" strokeWidth="16" strokeLinejoin="round" />
          {/* shine */}
          <ellipse cx="70" cy="78" rx="12" ry="7" fill="#FFFBE0" opacity="0.8" transform="rotate(-30 70 78)" />

          {/* cheeks */}
          <ellipse cx="62" cy="128" rx="11" ry="7" fill="#FF8FB1" opacity="0.65" />
          <ellipse cx="138" cy="128" rx="11" ry="7" fill="#FF8FB1" opacity="0.65" />

          {/* eyebrows for surprise */}
          {mood === 'surprised' && (
            <g stroke="#5B3A00" strokeWidth="4" strokeLinecap="round" fill="none">
              <path d="M66 88 q10 -9 20 0" />
              <path d="M114 88 q10 -9 20 0" />
            </g>
          )}

          {/* eyes */}
          {closedEyes ? (
            <g stroke="#3B2600" strokeWidth="5" strokeLinecap="round" fill="none">
              {mood === 'sleepy' ? (
                <>
                  <path d="M66 110 q10 6 20 0" />
                  <path d="M114 110 q10 6 20 0" />
                </>
              ) : (
                <>
                  <path d="M66 112 q10 -12 20 0" />
                  <path d="M114 112 q10 -12 20 0" />
                </>
              )}
            </g>
          ) : (
            <g className="ms-eyes">
              <ellipse cx="76" cy="108" rx={mood === 'surprised' ? 11 : 9} ry={mood === 'surprised' ? 14 : 12} fill="#3B2600" />
              <ellipse cx="124" cy="108" rx={mood === 'surprised' ? 11 : 9} ry={mood === 'surprised' ? 14 : 12} fill="#3B2600" />
              <circle cx={lookUp ? 80 : 79} cy={lookUp ? 100 : 103} r="4" fill="#fff" />
              <circle cx={lookUp ? 128 : 127} cy={lookUp ? 100 : 103} r="4" fill="#fff" />
              <circle cx="73" cy="113" r="2" fill="#fff" opacity="0.8" />
              <circle cx="121" cy="113" r="2" fill="#fff" opacity="0.8" />
            </g>
          )}

          {/* mouth */}
          {mood === 'happy' && <path d="M84 132 q16 16 32 0" stroke="#3B2600" strokeWidth="5" strokeLinecap="round" fill="none" />}
          {mood === 'talking' && <ellipse className="ms-mouth-talk" cx="100" cy="136" rx="10" ry="8" fill="#8A2C2C" />}
          {mood === 'thinking' && <path d="M88 138 q6 -5 12 0 q6 5 12 0" stroke="#3B2600" strokeWidth="4.5" strokeLinecap="round" fill="none" />}
          {mood === 'surprised' && <ellipse cx="100" cy="140" rx="9" ry="11" fill="#8A2C2C" />}
          {mood === 'clapping' && <path d="M82 130 q18 0 36 0 q-2 20 -18 20 q-16 0 -18 -20z" fill="#8A2C2C" stroke="#3B2600" strokeWidth="3" strokeLinejoin="round" />}
          {mood === 'sleepy' && <ellipse cx="100" cy="138" rx="6" ry="4" fill="#8A2C2C" />}
        </g>

        {/* clapping hands */}
        {mood === 'clapping' && (
          <g className="ms-hands">
            <circle className="ms-hand-l" cx="78" cy="176" r="13" fill="#FFD84D" stroke="#F29E00" strokeWidth="4" />
            <circle className="ms-hand-r" cx="122" cy="176" r="13" fill="#FFD84D" stroke="#F29E00" strokeWidth="4" />
          </g>
        )}

        {/* thinking bubble */}
        {mood === 'thinking' && (
          <g className="ms-think">
            <circle cx="156" cy="62" r="5" fill="#fff" stroke="#C9B6FF" strokeWidth="2" />
            <circle cx="168" cy="44" r="8" fill="#fff" stroke="#C9B6FF" strokeWidth="2" />
            <text x="160" y="30" fontSize="30" fontWeight="900" fill="#7C5CFF">?</text>
          </g>
        )}

        {mood === 'sleepy' && (
          <g className="ms-zzz" fill="#7C5CFF" fontWeight="900">
            <text x="150" y="60" fontSize="22">z</text>
            <text x="164" y="42" fontSize="28">Z</text>
          </g>
        )}
      </svg>
    </div>
  );
}
