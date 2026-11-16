import type { Settings } from './types';
import { hashPin } from './util';

export const DEFAULT_PIN = '1234';

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  lang: 'zh',
  baseUrl: 'http://localhost:11434/v1',
  apiKey: '',
  textModel: 'qwen3',
  visionModel: 'qwen2.5vl',
  forceDemo: false,
  sttKind: 'webspeech',
  sttUrl: '',
  sttModel: 'whisper-1',
  voiceZh: '',
  voiceEn: '',
  ttsRate: 0.9,
  dailyLimitMin: 30,
  pinHash: hashPin(DEFAULT_PIN),
  pinChanged: false,
  systemPrompt: '',
  typingAssist: false,
  dialecticRatio: 1 / 3,
};
