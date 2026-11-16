# AI for Future — build spec (source of truth)

## Original user requirements (Chinese, verbatim)

# 任务：开发儿童 AI 学习游戏 "AI for Future"（MVP）

## 定位
帮 5 岁半女孩学会使用 AI、探索世界、培养解决问题的能力。不做识字教学。
两个模块：
1. 好奇森林（AI 问答）：学会提问，学会辩证思考。
2. 任务基地（任务闯关）：AI 导师发布任务，孩子完成。练习理解问题、收集信息、规划方案和反思。

## 用户
- 孩子：识字有限，中英双语 → 界面以图标、语音和动画为主，所有文字都可以朗读（TTS），输入以语音和拍照为主。
- 家长：PIN 保护的后台。

## 技术栈 (see DEPLOYMENT OVERRIDES below — they replace SQLite/Prisma and LAN deployment)
- Next.js + TypeScript，PWA，iPad 横屏优先
- LLM 通过 OpenAI 兼容接口调用，base_url / model 可配置；默认 Ollama：文本模型 qwen3，视觉模型 qwen2.5vl。
- 语音：STT whisper.cpp server 可选，Web Speech API；TTS 用浏览器 speechSynthesis（可替换）。
- 中文 / English / 双语，可切换。
- 所有数据仅存本地。

## 导师角色 "小星"
- 卡通形象，有开心、思考、惊讶、鼓掌等表情和动画，状态随对话变化。
- 每句话不超过 3 句，使用 5 岁孩子能懂的词，语气热情、具体地夸奖。
- 不直接给答案，多反问；不确定时说"我们一起查一查"；涉及火、电、刀、药品时提醒"要找大人"；被问到时诚实说明自己是电脑程序；不输出任何链接。

## 模块一：好奇森林（AI 问答）
- 孩子按住按钮说出问题 → 小星先反问"你觉得呢？" → 给简短回答 → 附一个可以在家观察或动手试的小办法。
- 提问即时评分：LLM 判断问题类型，并给出 1–3 星和一句夸奖。
  问题类型徽章：是什么 / 为什么 / 怎么做 / 如果…会怎样 / 真的吗（质疑）。
  例："你问了一个'如果'的问题，真像科学家！+2⭐"
- 辩证思维：约 1/3 的回答由小星给出两种说法，或者"有人认为…也有人认为…"，再问她"你同意哪个？为什么？我们怎么验证？"。她说出理由就得星。
- 进阶关卡（线性解锁，依据提问行为自动判定）：
  ①问出第一个问题 ②问一个"为什么" ③连续追问 3 次 ④问一个"如果…会怎样" ⑤对小星的回答说"真的吗？"并说出理由 ⑥比较两种说法并给出自己的选择

## 模块二：任务基地（任务闯关）
- 小星从任务库（`content/missions.json`）中挑选任务并语音发布，难度随完成情况自适应。
  家长可以在后台添加任务，也可以让 LLM 按模板生成新任务（需家长审核）。
- 每个任务固定 4 关，每关完成立刻得星（step stars 即时入账）：
  1. 理解问题：她用自己的话复述任务，小星判断是否理解，没理解就换个说法再讲一次。（+1⭐）
  2. 收集信息：至少收集 2 张"信息卡"，来源可以是问小星、问家人（录音）、观察或拍照。每张卡都要选一个来源图标；卡片会收进她的收藏册。（每张 +1⭐）
  3. 规划方案：画出方案拍照上传，或用语音讲出来。小星用视觉模型看图，先具体夸一点，再问一个能改进方案的问题。她改进一次可以额外得星。（+1~3⭐）
  4. 完成和反思：线下动手完成，拍照上传成果，再录音回答"什么做得好？什么没成功？下次怎么改？"。（+1~3⭐）
- 通关：小星评估成果，给出 1–3 颗"通关大星"。大星进入"待家长确认"，确认后入账，并播放通关动画、解锁下一个任务。
- 评估统一输出 JSON：`{stars, praise, one_question_or_suggestion, safety_flag}`，只按任务 rubric 评分。
- 预置 6 个任务：①给阳台植物设计浇水提醒 ②给家里做垃圾分类标签 ③开一天"家庭小卖部"（定价+海报）④为家人设计一份早餐菜单 ⑤搭一座能承重一本书的纸桥 ⑥规划一次家庭出游要带的东西

## 任务数据结构
id, title_zh/en, brief_zh/en（TTS 朗读）, difficulty(1-3), unlock_requires[], understand_check（核心要点）, info_hints[], plan_rubric[], result_rubric[]（儿童语言）, reflection_prompts[], est_minutes。
(bilingual fields like info_hints etc. should be objects {zh, en} or arrays of {zh,en}.)

## 激励系统（要有趣，反馈要即时）
- 星星动画 + 音效 + 小星鼓掌动作，每一步都有反馈，不等到最后。
- 等级称号：小探索者 → 小提问家 → 小侦探 → 小发明家 → 未来创想家。
- 徽章墙（问题类型徽章 + 任务徽章）、信息卡收藏册、连续打卡奖励（每日首次 +1，连续 7 天 +5）。
- 奖励商店：家长配置奖励（名称、图片、所需星数）。孩子发起兑换，家长确认后扣星，保留兑换记录。

## 安全与家长后台
- 记录全部对话和上传内容；每天生成摘要（提问清单、兴趣点、提问类型分布、safety_flag）。
- 每日使用时长上限（默认 30 分钟），到时由小星语音提醒并锁定。
- 后台功能：待确认通关、奖励商店、兑换记录、对话日志、任务编辑与 AI 生成审核、系统提示词编辑、模型、语言和时长设置。

## 验收标准
- 不识字的孩子能独立完成一轮问答和一个任务的全部 4 步。
- 每一步操作后 2 秒内有视觉或声音反馈（LLM 等待时显示小星"思考中"动画）。
- 解锁、即时星、家长确认、兑换扣星的逻辑全部正确。
- 改 base_url 和 model 即可切换模型；改 JSON 即可新增任务和关卡。
- 附 README。

## DEPLOYMENT OVERRIDES (these win over the above)
Target: GitHub Pages static site, shared link opened on iPad Safari.
- Next.js (App Router) + TypeScript with `output: 'export'`, `trailingSlash: true`, `images.unoptimized`. basePath/assetPrefix from env `NEXT_PUBLIC_BASE_PATH` (default `/ai-for-future`; empty string allowed for local root serving). PWA: `public/manifest.webmanifest` + `public/sw.js` service worker that works under basePath (register with scope = basePath + '/'), app icons (generate PNG/SVG icons), apple-touch-icon, apple-mobile-web-app-capable meta, landscape orientation. iPad landscape (1180x820) first, huge touch targets (>=72px), icon/voice/animation-first UI, minimal text.
- No server: replace SQLite+Prisma with IndexedDB via Dexie behind a clean repository interface (`src/lib/data/` with a `Repo` interface and `DexieRepo` impl, so a server DB could be swapped in). All data on device. Parent backend: export/import JSON backup.
- LLM: browser calls OpenAI-compatible `POST {base_url}/chat/completions` directly. Settings (parent): base_url (default `http://localhost:11434/v1`), api_key (optional, Bearer), text model (default `qwen3`), vision model (default `qwen2.5vl`), stored locally. Vision: image_url data URL content parts.
- Built-in offline DEMO MODE: scripted/heuristic 小星 responses (bilingual), keyword question-type classifier (zh+en: 是什么/what, 为什么/why, 怎么/how, 如果/what if, 真的吗/really), rubric-ish heuristic scoring (length/keywords), used automatically when no LLM is reachable (health check with short timeout, cached) or when parent forces demo. So the shared link is fully playable with zero setup. A small parent-only status indicator (in parent backend + tiny dot visible only on parent screen) shows which mode is active.
- STT: Web Speech API (`webkitSpeechRecognition`, zh-CN / en-US) default; optional whisper.cpp server URL or OpenAI-compatible `/audio/transcriptions` URL in settings using MediaRecorder; graceful fallback. If mic is denied / unsupported: child sees a friendly 小星 message; a tap-to-type fallback is available only in parent view (parent can toggle "parent typing assist" which shows a keyboard input on child screens while parent unlocked/enabled). Hold-to-talk big button.
- TTS: speechSynthesis with zh-CN / en-US voice selection (settings), rate slightly slow for kids. EVERY visible text has a speaker button. iOS needs a user gesture to unlock audio: big "start" splash screen (tap star to begin) that unlocks speechSynthesis + AudioContext.
- Photos: `<input type=file accept="image/*" capture="environment">`, downscale to ~1024px JPEG before sending to vision model and before storing (store as data URL/blob in IndexedDB).
- All LLM evaluations return strict JSON `{stars, praise, one_question_or_suggestion, safety_flag}`; robust parsing: strip `<think>...</think>` (qwen3), extract first JSON object, clamp stars 1..3 (or 0..3 where relevant), defaults on failure. Mentor system prompt editable in backend with a sensible default enforcing the 小星 rules (≤3 sentences, kid words, no direct answers, ask back, "我们一起查一查", fire/electricity/knives/medicine → "要找大人", honest about being a computer program, never output links). Client-side: strip URLs from all LLM output, truncate to 3 sentences, local safety keyword check (火/电/刀/药/fire/knife/medicine/electric...) sets safety_flag and adds "find an adult" reminder.
- Missions in `content/missions.json` (imported at build), 6 presets with full bilingual fields, plus parent-added / LLM-generated missions (status pending → approved) in IndexedDB. Forest levels data-driven in `content/forest-levels.json` (id, title_zh/en, rule type + params, reward stars).
- Parent backend behind PIN (default 1234, changeable; prompt to change on first entry). Entry via a small long-press (1.5s) lock icon in a corner so kids don't stumble in. Daily time limit (default 30 min) tracked by active time; at limit 小星 speaks a reminder and a lock screen appears (parent PIN unlocks / extends). Daily summary generated from logs (LLM if available, else local stats): question list, interests (keywords), question-type distribution, safety flags.
- Backend sections: 待确认通关 (pending mission big stars), 奖励商店 (CRUD rewards: name, image upload, cost), 兑换记录 + pending redemptions confirm/reject, 对话日志 (all chats + uploads thumbnails, filter by date), 每日摘要, 任务编辑 (add/edit/disable missions) + AI 生成审核 (generate via LLM from template → pending → approve/reject), 系统提示词编辑, 模型/语言/时长/语音设置, 数据备份导出/导入, reset.
- Star ledger logic in pure TS (`src/lib/logic/`), unit-tested with vitest: step stars credited instantly; mission big stars pending → parent confirm → credited + celebration on child's next view + unlock next mission; reject also possible; reward redemption request → parent confirm → deduct (only if balance sufficient at confirm time), reject keeps balance, history kept; daily first-login +1, 7-day consecutive streak +5 (once per each 7-day streak milestone); level titles 小探索者→小提问家→小侦探→小发明家→未来创想家 by total earned stars thresholds (e.g. 0,10,30,60,100); forest level unlock rules ①–⑥ evaluated from question behavior; adaptive mission picking (next unlocked mission whose difficulty fits completion history). Balance = credited earnings − confirmed redemptions; "total earned" for level never decreases.
- 小星 mascot: SVG/CSS star character with states happy, thinking (shown during ANY LLM wait), surprised, clapping, talking (mouth anim while TTS speaks). Star burst animation + WebAudio-synthesized sound effects (ding, star, fanfare, click) — no external assets. Feedback within 2s of every action (immediate click sound + thinking anim).
- Bilingual zh / en / both, switchable (settings + quick toggle). In "both", show zh then en and TTS reads both.
- `.github/workflows/deploy.yml`: on push to main, Node 20+, npm ci, test, build with NEXT_PUBLIC_BASE_PATH=/${{ github.event.repository.name }}, touch out/.nojekyll, actions/configure-pages, actions/upload-pages-artifact (path out), actions/deploy-pages. Also `public/.nojekyll`.
- Test hooks: expose `window.__AIFF__` in non-production OR when URL has `?test=1`, allowing playwright to inject a transcript (simulate STT result) and inject a test image (simulate camera) — or simply ensure the parent typing assist + file inputs work for automation. Add `data-testid` attributes on key controls.
- README in Chinese with short English section (see task).
