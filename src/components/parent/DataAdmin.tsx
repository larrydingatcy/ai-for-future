'use client';

import { useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { validateBackup } from '@/lib/data/repo';
import { dayKey } from '@/lib/util';

export function DataAdmin() {
  const { game, refresh, saveSettings } = useApp();
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJson = async () => {
    const b = await game.repo.exportAll();
    const blob = new Blob([JSON.stringify(b)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ai-for-future-backup-${dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setMsg(`✅ 已导出 ${(blob.size / 1024).toFixed(0)} KB`);
  };

  return (
    <div className="p-section" data-testid="data-admin">
      <h2>💾 数据</h2>
      <p>所有数据（星星、对话、照片、设置）只保存在这台设备的浏览器里（IndexedDB），不会上传。换设备或清理 Safari 数据前，请先导出备份。</p>
      <div className="row gap">
        <button className="p-btn primary" onClick={exportJson}>
          ⬇️ 导出备份 JSON
        </button>
        <button className="p-btn" onClick={() => fileRef.current?.click()}>
          ⬆️ 导入备份
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const j = JSON.parse(await f.text());
              if (!validateBackup(j)) throw new Error('不是 AI for Future 的备份文件');
              if (!confirm('导入会覆盖这台设备上的全部数据，确定吗？')) return;
              await game.repo.importAll(j);
              await saveSettings({});
              await refresh();
              setMsg('✅ 导入完成');
            } catch (err) {
              setMsg(`⚠️ ${err instanceof Error ? err.message : err}`);
            }
          }}
        />
      </div>
      <h3>危险操作</h3>
      <button
        className="p-btn danger"
        onClick={async () => {
          if (!confirm('清空全部数据（星星、记录、设置）？此操作不能撤销。')) return;
          await game.repo.clearAll();
          location.reload();
        }}
      >
        🗑️ 清空全部数据
      </button>
      {msg && <div className="p-banner">{msg}</div>}
    </div>
  );
}
