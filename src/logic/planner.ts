import type { Activity, ActKind, CollectionItem, DayPlan, Plan, Todo } from '../types';

export interface PlanParams {
  days: number;
  budget: number;
  people: number;
  startDate: string;
  prefs: string[];
  request: string;
}

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function dayDate(plan: Pick<Plan, 'startDate'>, day: number) {
  const [y, m, d] = plan.startDate.split('-').map(Number);
  return new Date(y, m - 1, d + day - 1);
}

export const fmtDate = (d: Date, week = false) => `${d.getMonth() + 1}/${d.getDate()}${week ? ` ${WEEK[d.getDay()]}` : ''}`;

export const PREF_OPTIONS = ['少走回头路', '自然风景', '美食', '拍照', '轻松节奏'];
export const MIN_DAYS = 4;
export const MAX_DAYS = 6;

export const DEFAULT_PARAMS: PlanParams = {
  days: 5,
  budget: 3000,
  people: 2,
  startDate: '2026-11-14',
  prefs: ['少走回头路', '自然风景', '美食'],
  request: '帮我规划一份云南五日游，11月14日出发，预算 3000 元，尽量不走回头路。',
};

const CN_NUM: Record<string, number> = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const toNum = (s: string) => (/^\d+$/.test(s) ? Number(s) : CN_NUM[s] ?? NaN);
const CN_DIGIT = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

export const planName = (days: number) => `我的云南${CN_DIGIT[days] ?? days}日游`;

export interface ParsedRequest {
  days?: number;
  budget?: number;
  people?: number;
  startDate?: string;
  prefs: string[];
  warnings: string[];
}

/** 基于关键词规则解析自然语言需求（模拟，不调用大模型） */
export function parseRequest(text: string): ParsedRequest {
  const out: ParsedRequest = { prefs: [], warnings: [] };
  const d = text.replace(/\d{1,2}\s*月\s*\d{1,2}\s*[日号]/g, '').match(/(\d+|[一二两三四五六七八九十])\s*(天|日游|日)/);
  if (d) {
    const n = toNum(d[1]);
    if (!Number.isNaN(n)) {
      if (n < MIN_DAYS || n > MAX_DAYS) {
        out.warnings.push(`演示版支持 ${MIN_DAYS}–${MAX_DAYS} 天，已按 ${Math.min(MAX_DAYS, Math.max(MIN_DAYS, n))} 天处理`);
      }
      out.days = Math.min(MAX_DAYS, Math.max(MIN_DAYS, n));
    }
  }
  const b = text.match(/(\d{3,6})\s*(元|块)/) ?? text.match(/预算\s*(\d{3,6})/);
  if (b) out.budget = Number(b[1]);
  const p = text.match(/(\d+|[一两二三四五六])\s*(个)?人/);
  if (p) {
    const n = toNum(p[1]);
    if (!Number.isNaN(n)) out.people = n;
  }
  const dt = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/);
  if (dt) {
    const y = DEFAULT_PARAMS.startDate.slice(0, 4);
    out.startDate = `${y}-${dt[1].padStart(2, '0')}-${dt[2].padStart(2, '0')}`;
  }
  const rules: [RegExp, string][] = [
    [/回头路|折返|顺路/, '少走回头路'],
    [/风景|自然|洱海|雪山|山|湖/, '自然风景'],
    [/吃|美食|小吃/, '美食'],
    [/拍照|出片|机位/, '拍照'],
    [/轻松|不累|慢|休闲/, '轻松节奏'],
  ];
  for (const [re, pref] of rules) if (re.test(text)) out.prefs.push(pref);
  if (/上海|北京|成都|西藏|新疆|日本|泰国|三亚|厦门|杭州/.test(text)) {
    out.warnings.push('当前任务基于「云南旅行」收藏夹，其他目的地不在本次参考范围内');
  }
  return out;
}

/* ---------------- 收藏夹理解 ---------------- */

/** multi：多篇收藏提及；single：单篇收藏提及；insufficient：信息不足 / 待确认 */
export type InsightLevel = 'multi' | 'single' | 'insufficient';

export interface Insight {
  label: string;
  /** 只包含收藏夹中真实存在的内容 id，无来源时为空数组 */
  sourceIds: string[];
  level: InsightLevel;
  reason?: string;
}

export interface Understanding {
  spots: Insight[];
  stays: Insight[];
  foods: Insight[];
  routes: Insight[];
  risks: Insight[];
  /** 信息不足 / 待确认：无法识别实体的收藏、计划需要但收藏中缺少来源的主题 */
  gaps: Insight[];
}

const levelOf = (n: number): InsightLevel => (n >= 2 ? 'multi' : n === 1 ? 'single' : 'insufficient');

/** 计划会用到、但需要在收藏中找到来源的主题（规则预置） */
const PLAN_NEEDS: { label: string; match: RegExp; minDays: number; reason: string }[] = [
  { label: '玉龙雪山', match: /玉龙雪山|雪山/, minDays: 6, reason: '6 日游会安排雪山，但收藏中没有相关笔记，门票与预约信息待确认' },
  { label: '往返大交通（机票/火车）', match: /机票|航班|往返/, minDays: 0, reason: '收藏中没有往返大交通信息，计划预算不包含这部分' },
];

/**
 * 汇总收藏夹中预置的结构化字段（entities）。
 * 冲突检测尚未实现：当前数据结构没有可比较的属性，不能识别收藏之间的矛盾。
 */
export function understandCollection(items: CollectionItem[], opts: { days?: number } = {}): Understanding {
  const keys = ['spots', 'stays', 'foods', 'routes', 'risks'] as const;
  const acc = Object.fromEntries(keys.map((k) => [k, new Map<string, string[]>()])) as Record<(typeof keys)[number], Map<string, string[]>>;
  for (const item of items) {
    for (const k of keys) {
      for (const label of item.entities[k] ?? []) {
        const ids = acc[k].get(label) ?? [];
        if (!ids.includes(item.id)) acc[k].set(label, [...ids, item.id]);
      }
    }
  }
  const toList = (m: Map<string, string[]>): Insight[] =>
    [...m.entries()]
      .map(([label, sourceIds]) => ({ label, sourceIds, level: levelOf(sourceIds.length) }))
      .sort((a, b) => b.sourceIds.length - a.sourceIds.length);

  const gaps: Insight[] = [];
  for (const item of items) {
    const empty = keys.every((k) => !(item.entities[k] ?? []).length);
    if (empty) {
      gaps.push({
        label: item.title.replace(/^评论补充：/, '评论：'),
        sourceIds: [item.id],
        level: 'insufficient',
        reason: '未从中识别出景点、住宿等结构化信息；生成计划后可用「检查对行程的影响」逐条分析',
      });
    }
  }
  const allText = items.map((i) => `${i.title}${i.body.join('')}${Object.values(i.entities).flat().join('')}`).join('\n');
  for (const need of PLAN_NEEDS) {
    if ((opts.days ?? 0) >= need.minDays && !need.match.test(allText)) {
      gaps.push({ label: need.label, sourceIds: [], level: 'insufficient', reason: need.reason });
    }
  }
  return { spots: toList(acc.spots), stays: toList(acc.stays), foods: toList(acc.foods), routes: toList(acc.routes), risks: toList(acc.risks), gaps };
}

/* ---------------- 行程生成 ---------------- */

const r10 = (n: number) => Math.round(n / 10) * 10;

function act(
  id: string,
  time: string,
  title: string,
  place: string,
  kind: ActKind,
  cost: number,
  detail: string,
  sourceIds: string[],
  extra: Partial<Activity> = {},
): Activity {
  return { id, time, title, place, kind, cost, detail, sourceIds, status: 'confirmed', ...extra };
}

type City = 'dali' | 'lijiang';
type SegmentKey = 'arrive' | 'erhai' | 'cangshan' | 'lijiang' | 'snow' | 'return';

interface Segment {
  key: SegmentKey;
  title: string;
  area: string;
  summary: string;
  /** 当晚住在哪个城市；返程日为 null */
  sleep: City | null;
  /** 在该城市首晚的入住时间 */
  checkIn?: string;
  activities: Activity[];
}

/** 不同天数的行程骨架：大理进、丽江出，返程日固定在最后一天 */
export const ITINERARIES: Record<number, SegmentKey[]> = {
  4: ['arrive', 'erhai', 'lijiang', 'return'],
  5: ['arrive', 'erhai', 'cangshan', 'lijiang', 'return'],
  6: ['arrive', 'erhai', 'cangshan', 'lijiang', 'snow', 'return'],
};

function segments(food: (n: number) => number): Record<SegmentKey, Segment> {
  return {
    arrive: {
      key: 'arrive',
      title: '抵达大理 · 古城初见',
      area: '大理古城',
      summary: '下午抵达，入住古城小院，晚上逛人民路。',
      sleep: 'dali',
      checkIn: '15:00',
      activities: [
        act('arrive-transport', '14:00', '抵达大理，机场大巴/动车进古城', '大理站', 'transport', 25, '往返大交通不计入本预算。', ['n-route', 'n-transport']),
        act('arrive-walk', '16:00', '人民路、复兴路散步', '大理古城', 'spot', 0, '第一天不安排远途，熟悉古城。', ['n-route']),
        act('arrive-dinner', '18:30', '晚餐：阿鹏酸辣鱼（古城店）', '阿鹏酸辣鱼（古城店）', 'food', food(90), '本地人排队的白族酸辣鱼，建议 18 点前到。', ['n-fish', 'n-food'], {
          aliases: { strong: ['阿鹏酸辣鱼', '阿鹏'] },
        }),
      ],
    },
    erhai: {
      key: 'erhai',
      title: '洱海西岸 · 机位与喜洲',
      area: '洱海西岸 / 喜洲',
      summary: '包车环洱海西岸，上午拍照，中午到喜洲，傍晚回古城。',
      sleep: 'dali',
      activities: [
        act('erhai-car', '08:30', '包车出发，环洱海西岸', '大理古城', 'transport', 150, '包车约 300 元/天，2 人分摊。', ['n-transport']),
        act('erhai-photo', '09:30', '海西白墙机位拍照', '海西白墙机位', 'photo', 20, '上午 10 点前顺光、人少，预留 1.5 小时。', ['n-photo'], {
          aliases: { strong: ['白墙机位', '海西白墙', '白墙'], weak: ['机位', '拍照点', '网红'] },
        }),
        act('erhai-lunch', '11:40', '午餐：喜洲粑粑（老街现烤）', '喜洲古镇', 'food', food(50), '12 点前到，排队较短。', ['n-food', 'c-xizhou']),
        act('erhai-xizhou', '13:00', '喜洲古镇 + 麦田散步', '喜洲古镇', 'spot', 0, '古镇和麦田相连，午后顺路。', ['n-route', 'n-photo']),
        act('erhai-dinner', '18:00', '回古城晚餐', '大理古城', 'food', food(80), '晚上可自由活动。', ['n-food']),
      ],
    },
    cangshan: {
      key: 'cangshan',
      title: '三塔与苍山',
      area: '大理古城周边',
      summary: '上午三塔顺光，下午苍山索道。',
      sleep: 'dali',
      activities: [
        act('cangshan-pagoda', '09:00', '崇圣寺三塔', '崇圣寺三塔', 'spot', 75, '上午顺光，可坐观光车。', ['n-pagoda']),
        act('cangshan-lunch', '12:00', '午餐：烤饵块 + 米线', '大理古城', 'food', food(40), '', ['n-food']),
        act('cangshan-cable', '14:00', '苍山洗马潭索道', '苍山洗马潭', 'spot', 280, '山顶温度低，带外套。', ['n-cangshan'], {
          status: 'pending',
          statusNote: '需提前 1–3 天线上预约，尚未预约',
          aliases: { strong: ['苍山', '洗马潭', '索道'] },
        }),
        act('cangshan-dinner', '18:30', '晚餐：古城私房菜', '大理古城', 'food', food(90), '', ['n-food']),
      ],
    },
    lijiang: {
      key: 'lijiang',
      title: '动车去丽江 · 古城日落',
      area: '丽江古城',
      summary: '上午退房坐动车到丽江，下午木府，傍晚狮子山。',
      sleep: 'lijiang',
      checkIn: '12:30',
      activities: [
        act('lijiang-train', '09:30', '大理古城退房，动车 大理 → 丽江（约 2 小时）', '大理站', 'transport', 70, '单向前进，不回大理。', ['n-transport', 'n-route']),
        act('lijiang-mufu', '14:30', '丽江古城 + 木府', '丽江古城', 'spot', 60, '避开银器店强推，低价一日游不参加。', ['n-lijiang', 'n-pit']),
        act('lijiang-sunset', '18:30', '狮子山看古城日落', '狮子山', 'spot', 0, '日落约 19:30（演示数据）。', ['n-lijiang']),
        act('lijiang-dinner', '20:00', '晚餐：纳西烤鱼', '丽江古城', 'food', food(100), '', ['n-food']),
      ],
    },
    snow: {
      key: 'snow',
      title: '玉龙雪山 · 蓝月谷',
      area: '丽江北部',
      summary: '从丽江古城往返雪山，晚上回同一家客栈。',
      sleep: 'lijiang',
      activities: [
        act('snow-car', '07:30', '包车前往玉龙雪山（往返）', '丽江古城', 'transport', 120, '包车价格参考收藏中的包车笔记。', ['n-transport']),
        act('snow-park', '09:00', '玉龙雪山 + 蓝月谷', '玉龙雪山', 'spot', 280, '收藏中没有雪山攻略，按通用安排估算。', [], {
          status: 'pending',
          statusNote: '收藏中暂无直接来源；门票与索道需提前预约',
        }),
        act('snow-lunch', '13:00', '午餐：景区附近简餐', '玉龙雪山', 'food', food(50), '', []),
        act('snow-dinner', '19:00', '回古城晚餐：鸡豆凉粉 + 小吃', '丽江古城', 'food', food(70), '', ['n-food']),
      ],
    },
    return: {
      key: 'return',
      title: '束河慢逛 · 返程',
      area: '束河古镇',
      summary: '上午退房去束河，午饭后返程。',
      sleep: null,
      activities: [
        act('return-shuhe', '09:00', '丽江退房，束河古镇慢逛', '束河古镇', 'spot', 0, '上午人少，束河离机场更近。', ['n-shuhe']),
        act('return-lunch', '12:00', '午餐：鸡豆凉粉 + 鲜花饼', '束河古镇', 'food', food(60), '', ['n-food']),
        act('return-back', '14:30', '前往丽江机场/车站返程', '丽江机场', 'transport', 25, '往返大交通不计入本预算。', ['n-shuhe']),
      ],
    },
  };
}

const STAY_INFO: Record<City, { name: string; place: string; base: number; sources: string[] }> = {
  dali: { name: '人民路白族小院', place: '大理古城', base: 220, sources: ['n-stay-dali'] },
  lijiang: { name: '丽江古城外围客栈', place: '丽江古城', base: 240, sources: ['c-stay-lijiang', 'n-pit'] },
};

/** 根据每晚所在城市生成住宿：每个非返程日恰好一晚 */
function stayFor(city: City, nightNo: number, total: number, checkIn: string | undefined, stayCost: number): Activity {
  const info = STAY_INFO[city];
  const first = nightNo === 1;
  const id = first ? `${city}-stay` : `${city}-stay-${nightNo}`;
  const title = first ? `入住${info.name}（共 ${total} 晚）` : `住${info.name} · 第 ${nightNo} 晚`;
  const extra: Partial<Activity> =
    city === 'lijiang'
      ? {
          status: 'pending',
          statusNote: first ? '具体客栈尚未选定' : '与入住当晚同一客栈，待选定',
          aliases: first ? { strong: ['丽江古城', '客栈', '酒吧街'] } : undefined,
        }
      : {};
  const detail =
    city === 'dali'
      ? first
        ? `连住 ${total} 晚，订房时备注远离酒吧一侧。`
        : '同一家小院续住。'
      : first
        ? '外围步行 10 分钟进古城，避开酒吧街。'
        : '同一家客栈续住。';
  return act(id, first && checkIn ? checkIn : '21:00', title, info.place, 'stay', stayCost, detail, info.sources, extra);
}

/** f：住宿与餐饮档位系数，随预算缩放 */
export function buildDays(f: number, days: number): DayPlan[] {
  const keys = ITINERARIES[days] ?? ITINERARIES[5];
  const segs = segments((n) => r10(n * f));
  const nightsIn = (city: City) => keys.filter((k) => segs[k].sleep === city).length;
  const seen: Record<City, number> = { dali: 0, lijiang: 0 };

  return keys.map((key, i) => {
    const seg = segs[key];
    const activities = seg.activities.map((a) => ({ ...a }));
    if (seg.sleep) {
      seen[seg.sleep] += 1;
      activities.push(stayFor(seg.sleep, seen[seg.sleep], nightsIn(seg.sleep), seg.checkIn, r10(STAY_INFO[seg.sleep].base * f)));
    }
    activities.sort((a, b) => a.time.localeCompare(b.time));
    return { id: `day-${key}`, day: i + 1, title: seg.title, area: seg.area, summary: seg.summary, activities };
  });
}

const dayOf = (dayPlans: DayPlan[], key: SegmentKey) => dayPlans.find((d) => d.id === `day-${key}`)?.day;
const countNights = (dayPlans: DayPlan[], city: City) =>
  dayPlans.filter((d) => d.activities.some((a) => a.kind === 'stay' && a.id.startsWith(`${city}-stay`))).length;

/** 待办基于最终日程生成，不引用固定 Day 编号 */
export function buildTodos(dayPlans: DayPlan[]): Todo[] {
  const todos: Todo[] = [];
  const daliNights = countNights(dayPlans, 'dali');
  const ljNights = countNights(dayPlans, 'lijiang');
  todos.push({ id: 't-stay-dali', text: `预订大理古城小院（${daliNights} 晚）`, done: false, day: dayOf(dayPlans, 'arrive') });
  todos.push({ id: 't-car', text: '联系洱海西岸包车司机', done: false, day: dayOf(dayPlans, 'erhai') });
  if (dayOf(dayPlans, 'cangshan')) todos.push({ id: 't-cable', text: '提前预约苍山洗马潭索道', done: false, day: dayOf(dayPlans, 'cangshan') });
  todos.push({ id: 't-train', text: '购买大理 → 丽江动车票', done: false, day: dayOf(dayPlans, 'lijiang') });
  todos.push({ id: 't-stay-lijiang', text: `预订丽江古城外围客栈（${ljNights} 晚）`, done: false, day: dayOf(dayPlans, 'lijiang') });
  if (dayOf(dayPlans, 'snow')) todos.push({ id: 't-snow', text: '预约玉龙雪山门票与索道', done: false, day: dayOf(dayPlans, 'snow') });
  todos.push({ id: 't-coat', text: '准备外套（山顶/早晚温差大）', done: false });
  return todos;
}

export function generatePlan(params: PlanParams, at: string): Plan {
  const days = ITINERARIES[params.days] ? params.days : 5;
  const f = Math.min(1.5, Math.max(0.7, params.budget / 3000));
  const dayPlans = buildDays(f, days);
  const notes = [
    params.prefs.includes('少走回头路') ? '路线采用「大理进、丽江出」，全程单向不折返。' : '路线以收藏笔记中的大理 → 丽江顺序为主。',
    '景点、住宿和餐饮均优先选用收藏夹中出现过的内容，并标注来源；没有来源的安排会标明。',
    params.prefs.includes('美食') ? '每天至少安排一顿收藏里的本地美食。' : '餐饮以顺路为主，不额外绕路。',
    params.prefs.includes('轻松节奏') ? '每天主要活动不超过 3 个，下午留出休息时间。' : '收藏中的避坑提醒已写入对应日期的注意事项。',
  ];
  return {
    id: 'plan-yunnan',
    name: planName(days),
    days,
    budget: params.budget,
    people: params.people,
    startDate: params.startDate,
    prefs: params.prefs,
    request: params.request,
    notes,
    dayPlans,
    todos: buildTodos(dayPlans),
    changes: [],
    version: 1,
    createdAt: at,
    updatedAt: at,
  };
}

/** 检查行程一致性，返回问题列表（空数组表示通过） */
export function validatePlan(plan: Plan): string[] {
  const issues: string[] = [];
  const { dayPlans } = plan;
  if (dayPlans.length !== plan.days) issues.push(`天数不一致：days=${plan.days}，日程 ${dayPlans.length} 天`);
  dayPlans.forEach((d, i) => d.day !== i + 1 && issues.push(`Day 编号不连续：第 ${i + 1} 项为 Day ${d.day}`));
  const ids = dayPlans.flatMap((d) => d.activities.map((a) => a.id));
  if (new Set(ids).size !== ids.length) issues.push('存在重复的安排 id');
  let leftDali = false;
  dayPlans.forEach((d, i) => {
    const last = i === dayPlans.length - 1;
    const stays = d.activities.filter((a) => a.kind === 'stay');
    if (last && stays.length) issues.push(`返程日 Day ${d.day} 不应有住宿`);
    if (!last && stays.length !== 1) issues.push(`Day ${d.day} 住宿数量为 ${stays.length}`);
    const sorted = [...d.activities].sort((a, b) => a.time.localeCompare(b.time));
    if (sorted.some((a, k) => a.id !== d.activities[k].id)) issues.push(`Day ${d.day} 安排未按时间排序`);
    const city = stays[0]?.id.startsWith('lijiang') ? 'lijiang' : stays[0] ? 'dali' : null;
    if (city === 'lijiang') leftDali = true;
    if (city === 'dali' && leftDali) issues.push(`Day ${d.day} 回到大理住宿，路线走了回头路`);
  });
  const lastDay = dayPlans[dayPlans.length - 1];
  const back = lastDay?.activities.find((a) => a.id === 'return-back');
  if (!back) issues.push('最后一天没有返程安排');
  else if (lastDay.activities.some((a) => a.time > back.time)) issues.push('返程之后仍有安排');
  if (dayPlans.slice(0, -1).some((d) => d.activities.some((a) => a.id === 'return-back'))) issues.push('返程不在最后一天');
  if (dayPlans.filter((d) => d.activities.some((a) => a.kind === 'stay')).length !== plan.days - 1) issues.push('住宿晚数应为天数 - 1');
  const trainDay = dayPlans.find((d) => d.activities.some((a) => a.id === 'lijiang-train'));
  const firstLj = dayPlans.find((d) => d.activities.some((a) => a.id.startsWith('lijiang-stay')));
  if (!trainDay || trainDay !== firstLj) issues.push('去丽江的动车与丽江首晚不在同一天');
  return issues;
}

export const KIND_LABEL: Record<ActKind, string> = {
  stay: '住宿',
  transport: '交通',
  food: '餐饮',
  spot: '门票/体验',
  photo: '门票/体验',
};

export interface BudgetLine {
  label: string;
  amount: number;
}

export function dayCost(d: DayPlan) {
  return d.activities.reduce((s, a) => s + a.cost, 0);
}

export function budgetBreakdown(plan: Plan): { lines: BudgetLine[]; used: number; reserve: number } {
  const map = new Map<string, number>();
  for (const label of ['住宿', '交通', '餐饮', '门票/体验']) map.set(label, 0);
  for (const d of plan.dayPlans) for (const a of d.activities) map.set(KIND_LABEL[a.kind], (map.get(KIND_LABEL[a.kind]) ?? 0) + a.cost);
  const lines = [...map.entries()].map(([label, amount]) => ({ label, amount }));
  const used = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, used, reserve: plan.budget - used };
}

export function planStats(plan: Plan) {
  const acts = plan.dayPlans.flatMap((d) => d.activities);
  return {
    confirmed: acts.filter((a) => a.status === 'confirmed').length,
    pending: acts.filter((a) => a.status === 'pending').length,
    risk: acts.filter((a) => a.status === 'risk').length,
    total: acts.length,
  };
}
