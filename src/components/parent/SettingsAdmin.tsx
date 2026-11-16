'use client';

import { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { ModeBadge } from './ParentApp';
import { ping } from '@/lib/ai/llm';
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { tts } from '@/lib/speech/tts';
import { sttAvailable } from '@/lib/speech/stt';
import type { Settings } from '@/lib/types';
import { hashPin } from '@/lib/util';

export function SettingsAdmin() {
  const { settings, saveSettings, recheckMode } = useApp();
  const [s, setS] = useState<Settings>(settings);
  const [saved, setSaved] = useState('');
  const [test, setTest] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [pin1, setPin1] = useState('');
  useEffect(() => setS(settings), [settings]);
  useEffect(() => {
    const load = () => setVoices(tts.voices());
    load();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener?.('voiceschanged', load);
      return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load);
    }
  }, []);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const save = async () => {
    const { pinHash: _p, pinChanged: _c, ...rest } = s;
    await saveSettings(rest);
    setSaved('✅ 已保存');
    setTimeout(() => setSaved(''), 2500);
  };
  const testConn = async () => {
    setTest('连接中…');
    const r = await ping({ baseUrl: s.baseUrl, apiKey: s.apiKey }, 5000);
    if (r.ok) {
      const missing = [s.textModel, s.visionModel].filter((m) => r.models.length && !r.models.some((x) => x === m || x.startsWith(`${m}:`)));
      setTest(`✅ 已连接。模型：${r.models.join(', ') || '（未列出）'}${missing.length ? `\n⚠️ 没找到：${missing.join(', ')}（请 ollama pull）` : ''}`);
    } else {
      const https = typeof location !== 'undefined' && location.protocol === 'https:' && s.baseUrl.startsWith('http:');
      setTest(
        `✖️ 连不上（${r.error}）。${https ? '\n本页面是 HTTPS，浏览器会拦截 http:// 地址（混合内容）。请用 HTTPS 地址（如 tailscale serve / cloudflared），或在本地用 http 打开本应用。' : ''}\n还要确认 Ollama 设置了 OLLAMA_ORIGINS 允许本网站。`,
      );
    }
  };

  const zhVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('zh'));
  const enVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));

  return (
    <div className="p-section p-settings" data-testid="settings">
      <h2>⚙️ 设置</h2>
      <div className="row gap">
        <ModeBadge />
        <button className="p-btn" onClick={() => void recheckMode()}>
          重新检测
        </button>
      </div>

      <fieldset>
        <legend>🤖 AI 模型（OpenAI 兼容接口）</legend>
        <label>
          base_url
          <input data-testid="set-baseurl" value={s.baseUrl} onChange={(e) => set('baseUrl', e.target.value)} placeholder="http://localhost:11434/v1" />
        </label>
        <label>
          API Key（可选）
          <input type="password" value={s.apiKey} onChange={(e) => set('apiKey', e.target.value)} placeholder="Ollama 不需要" autoComplete="off" />
        </label>
        <label>
          文本模型
          <input value={s.textModel} onChange={(e) => set('textModel', e.target.value)} />
        </label>
        <label>
          视觉模型
          <input value={s.visionModel} onChange={(e) => set('visionModel', e.target.value)} />
        </label>
        <label className="inline">
          <input type="checkbox" data-testid="set-forcedemo" checked={s.forceDemo} onChange={(e) => set('forceDemo', e.target.checked)} /> 强制使用演示模式（不连模型）
        </label>
        <div className="row gap">
          <button className="p-btn" onClick={testConn}>
            🔌 测试连接
          </button>
        </div>
        {test && <pre className="p-pre">{test}</pre>}
      </fieldset>

      <fieldset>
        <legend>🗣️ 语言与语音</legend>
        <label>
          界面语言
          <select value={s.lang} onChange={(e) => set('lang', e.target.value as Settings['lang'])}>
            <option value="zh">中文</option>
            <option value="en">English</option>
            <option value="both">双语 中/EN</option>
          </select>
        </label>
        <label>
          中文声音
          <select value={s.voiceZh} onChange={(e) => set('voiceZh', e.target.value)}>
            <option value="">自动</option>
            {zhVoices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </label>
        <label>
          英文声音
          <select value={s.voiceEn} onChange={(e) => set('voiceEn', e.target.value)}>
            <option value="">自动</option>
            {enVoices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </label>
        <label>
          语速 {s.ttsRate.toFixed(2)}
          <input type="range" min={0.6} max={1.2} step={0.05} value={s.ttsRate} onChange={(e) => set('ttsRate', Number(e.target.value))} />
        </label>
        <button
          className="p-btn"
          onClick={() =>
            void tts.speak(
              [
                { text: '你好，我是小星！', lang: 'zh' },
                { text: "Hi, I'm Xiaoxing!", lang: 'en' },
              ],
              { voiceZh: s.voiceZh, voiceEn: s.voiceEn, rate: s.ttsRate },
            )
          }
        >
          🔊 试听
        </button>
      </fieldset>

      <fieldset>
        <legend>🎤 语音识别</legend>
        <label>
          方式
          <select value={s.sttKind} onChange={(e) => set('sttKind', e.target.value as Settings['sttKind'])}>
            <option value="webspeech">浏览器语音识别（默认，iPad Safari 可用）</option>
            <option value="whisper">whisper.cpp server（/inference）</option>
            <option value="openai">OpenAI 兼容 /audio/transcriptions</option>
          </select>
        </label>
        {s.sttKind !== 'webspeech' && (
          <>
            <label>
              识别地址
              <input value={s.sttUrl} onChange={(e) => set('sttUrl', e.target.value)} placeholder={s.sttKind === 'whisper' ? 'https://mac.tailnet.ts.net:8443/inference' : 'https://api.example.com/v1/audio/transcriptions'} />
            </label>
            {s.sttKind === 'openai' && (
              <label>
                模型
                <input value={s.sttModel} onChange={(e) => set('sttModel', e.target.value)} />
              </label>
            )}
          </>
        )}
        <p className="muted">当前设备：{sttAvailable(s) ? '✅ 可以语音输入' : '⚠️ 不支持语音识别'}</p>
        <label className="inline">
          <input type="checkbox" data-testid="set-typing" checked={s.typingAssist} onChange={(e) => set('typingAssist', e.target.checked)} /> 家长代打字（在话筒旁显示键盘输入框，麦克风不可用时使用）
        </label>
      </fieldset>

      <fieldset>
        <legend>⏱️ 使用与玩法</legend>
        <label>
          每日时长上限（分钟）
          <input type="number" min={5} max={240} value={s.dailyLimitMin} onChange={(e) => set('dailyLimitMin', Number(e.target.value) || 30)} />
        </label>
        <label>
          辩证回答比例 {Math.round(s.dialecticRatio * 100)}%
          <input type="range" min={0} max={1} step={1 / 6} value={s.dialecticRatio} onChange={(e) => set('dialecticRatio', Number(e.target.value))} />
        </label>
      </fieldset>

      <fieldset>
        <legend>📝 小星的系统提示词</legend>
        <textarea className="json-editor" value={s.systemPrompt || DEFAULT_SYSTEM_PROMPT} onChange={(e) => set('systemPrompt', e.target.value === DEFAULT_SYSTEM_PROMPT ? '' : e.target.value)} />
        <button className="p-btn" onClick={() => set('systemPrompt', '')}>
          恢复默认
        </button>
        <p className="muted">无论提示词怎么写，应用都会额外删除回答里的链接、限制为 3 句话，并在涉及危险话题时加上"要找大人"。</p>
      </fieldset>

      <div className="row gap sticky-save">
        <button className="p-btn primary big" data-testid="settings-save" onClick={save}>
          💾 保存设置
        </button>
        {saved && <span>{saved}</span>}
      </div>

      <fieldset>
        <legend>🔐 修改家长密码</legend>
        <div className="row gap">
          <input type="password" inputMode="numeric" value={pin1} placeholder="新密码（4-8 位数字）" onChange={(e) => setPin1(e.target.value.replace(/\D/g, '').slice(0, 8))} />
          <button
            className="p-btn"
            disabled={pin1.length < 4}
            onClick={async () => {
              await saveSettings({ pinHash: hashPin(pin1), pinChanged: true });
              setPin1('');
              setSaved('✅ 密码已修改');
            }}
          >
            修改
          </button>
        </div>
      </fieldset>
    </div>
  );
}
