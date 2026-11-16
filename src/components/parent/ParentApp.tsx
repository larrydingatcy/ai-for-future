'use client';

import { useState } from 'react';
import { useApp } from '../AppContext';
import { PinPad } from '../Overlays';
import { hashPin } from '@/lib/util';
import { DEFAULT_PIN } from '@/lib/settings';
import { Inbox } from './Inbox';
import { RewardsAdmin } from './RewardsAdmin';
import { LogsAdmin } from './LogsAdmin';
import { SummaryAdmin } from './SummaryAdmin';
import { MissionsAdmin } from './MissionsAdmin';
import { SettingsAdmin } from './SettingsAdmin';
import { DataAdmin } from './DataAdmin';

const TABS = [
  { id: 'inbox', icon: '📬', label: '待确认' },
  { id: 'rewards', icon: '🎁', label: '奖励商店' },
  { id: 'logs', icon: '💬', label: '对话日志' },
  { id: 'summary', icon: '📊', label: '每日摘要' },
  { id: 'missions', icon: '🧩', label: '任务编辑' },
  { id: 'settings', icon: '⚙️', label: '设置' },
  { id: 'data', icon: '💾', label: '数据' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function ModeBadge() {
  const { mode, modeDetail, settings } = useApp();
  const label =
    mode === 'llm' ? `🟢 AI 模型已连接 · ${settings.textModel}` : mode === 'checking' ? '⚪ 正在检测模型…' : `🟡 演示模式 Demo${settings.forceDemo ? '（手动）' : ''}`;
  return (
    <span className={`mode-badge mode-${mode}`} data-testid="mode-badge" data-mode={mode} title={modeDetail}>
      {label}
    </span>
  );
}

export function ParentApp() {
  const { settings, saveSettings, go, micIssue } = useApp();
  const [unlocked, setUnlocked] = useState(false);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<TabId>('inbox');
  const [newPin, setNewPin] = useState('');
  const [skipPinPrompt, setSkipPinPrompt] = useState(false);

  if (!unlocked) {
    return (
      <main className="parent parent-gate">
        <button className="round-btn gate-back" onClick={() => go({ name: 'home' })} aria-label="back">
          ↩️
        </button>
        <PinPad
          title={{ zh: '家长密码（默认 1234）', en: 'Parent PIN (default 1234)' }}
          error={err}
          onSubmit={(pin) => {
            if (hashPin(pin) === settings.pinHash) {
              setUnlocked(true);
              setErr('');
            } else setErr('密码不对 / Wrong PIN');
          }}
        />
      </main>
    );
  }

  const mustChange = !settings.pinChanged && !skipPinPrompt;

  return (
    <main className="parent" data-testid="parent">
      <header className="parent-head">
        <h1>👨‍👩‍👧 家长后台 · Parents</h1>
        <ModeBadge />
        <button className="p-btn" data-testid="parent-exit" onClick={() => go({ name: 'home' })}>
          ↩️ 回到孩子界面
        </button>
      </header>
      {mustChange && (
        <div className="p-banner warn" data-testid="pin-prompt">
          <b>请先修改默认密码 {DEFAULT_PIN}</b>，避免孩子进入后台。
          <input type="password" inputMode="numeric" placeholder="新密码（4-8 位数字）" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))} />
          <button
            className="p-btn primary"
            disabled={newPin.length < 4}
            onClick={async () => {
              await saveSettings({ pinHash: hashPin(newPin), pinChanged: true });
              setNewPin('');
            }}
          >
            保存
          </button>
          <button className="p-btn" data-testid="pin-skip" onClick={() => setSkipPinPrompt(true)}>
            稍后
          </button>
        </div>
      )}
      {micIssue && (
        <div className="p-banner warn">
          🎤 麦克风不可用（{micIssue === 'denied' ? '权限被拒绝' : '此浏览器不支持语音识别'}）。请在 iPad 设置 → Safari → 麦克风 中允许，或在「设置」里开启“家长代打字”。
        </div>
      )}
      <div className="parent-body">
        <nav className="parent-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} data-testid={`tab-${t.id}`} onClick={() => setTab(t.id)}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </nav>
        <section className="parent-content">
          {tab === 'inbox' && <Inbox />}
          {tab === 'rewards' && <RewardsAdmin />}
          {tab === 'logs' && <LogsAdmin />}
          {tab === 'summary' && <SummaryAdmin />}
          {tab === 'missions' && <MissionsAdmin />}
          {tab === 'settings' && <SettingsAdmin />}
          {tab === 'data' && <DataAdmin />}
        </section>
      </div>
    </main>
  );
}
