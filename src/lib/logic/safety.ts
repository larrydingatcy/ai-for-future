import type { Bi } from '../types';

// Topics where 小星 must say "find a grown-up". Specific words avoid false alarms on 火车/电脑/电视.
const ZH = /火柴|打火机|点火|着火|失火|火灾|玩火|生火|蜡烛|燃气|煤气|炉子|灶|烧|火焰|插座|电线|触电|漏电|通电|电源|电池|电闸|插头|刀|剪刀|针|药|胶囊|毒|消毒液|漂白|热水壶|开水/;
const EN = /\bfire\b|lighter|\bmatch(es)?\b|\bburn|flame|candle|stove|\bgas\b|electric|outlet|socket|\bplug\b|\bwires?\b|batter(y|ies)|knife|knives|scissors|blade|needle|medicine|\bpills?\b|\bdrugs?\b|poison|bleach|boiling/i;

export function isSafetyTopic(text: string): boolean {
  return ZH.test(text) || EN.test(text);
}

export const SAFETY_REMINDER: Bi = {
  zh: '这个可能有危险，一定要找大人一起哦！',
  en: 'This could be dangerous, so always find a grown-up to help!',
};
