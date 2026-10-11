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

export interface Insight {
  label: string;
  sourceIds: string[];
}

export interface Understanding {
  spots: Insight[];
  stays: Insight[];
  foods: Insight[];
  routes: Insight[];
  risks: Insight[];
}

/** 汇总收藏夹中可被规划使用的实体（来自预置的结构化字段） */
export function understandCollection(items: CollectionItem[]): Understanding {
  const acc: Record<keyof Understanding, Map<string, string[]>> = {
    spots: new Map(),
    stays: new Map(),
    foods: new Map(),
    routes: new Map(),
    risks: new Map(),
  };
  for (const item of items) {
    (Object.keys(acc) as (keyof Understanding)[]).forEach((k) => {
      for (const label of item.entities[k] ?? []) {
        const ids = acc[k].get(label) ?? [];
        acc[k].set(label, [...ids, item.id]);
      }
    });
  }
  const toList = (m: Map<string, string[]>) => [...m.entries()].map(([label, sourceIds]) => ({ label, sourceIds }));
  return {
    spots: toList(acc.spots),
    stays: toList(acc.stays),
    foods: toList(acc.foods),
    routes: toList(acc.routes),
    risks: toList(acc.risks),
  };
}

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

/** f：住宿与餐饮档位系数，随预算缩放 */
function buildDays(f: number, days: number): DayPlan[] {
  const stay = (n: number) => r10(n * f);
  const food = (n: number) => r10(n * f);

  const d1: DayPlan = {
    id: 'day-arrive',
    day: 1,
    title: '抵达大理 · 古城初见',
    area: '大理古城',
    summary: '下午抵达，入住古城小院，晚上逛人民路。',
    activities: [
      act('d1-arrive', '14:00', '抵达大理，机场大巴/动车进古城', '大理站', 'transport', 25, '往返大交通不计入本预算。', ['n-route', 'n-transport']),
      act('d1-stay', '15:00', '入住人民路白族小院', '大理古城', 'stay', stay(220), '连住 3 晚，订房时备注远离酒吧一侧。', ['n-stay-dali']),
      act('d1-walk', '16:00', '人民路、复兴路散步', '大理古城', 'spot', 0, '第一天不安排远途，熟悉古城。', ['n-route']),
      act('d1-dinner', '18:30', '晚餐：阿鹏酸辣鱼（古城店）', '阿鹏酸辣鱼（古城店）', 'food', food(90), '本地人排队的白族酸辣鱼，建议 18 点前到。', ['n-fish', 'n-food'], {
        aliases: { strong: ['阿鹏酸辣鱼', '阿鹏'] },
      }),
    ],
  };

  const d2: DayPlan = {
    id: 'day-erhai',
    day: 2,
    title: '洱海西岸 · 机位与喜洲',
    area: '洱海西岸 / 喜洲',
    summary: '包车环洱海西岸，上午拍照，中午到喜洲。',
    activities: [
      act('d2-car', '08:30', '包车出发，环洱海西岸', '大理古城', 'transport', 150, '包车约 300 元/天，2 人分摊。', ['n-transport']),
      act('d2-photo', '09:30', '海西白墙机位拍照', '海西白墙机位', 'photo', 20, '上午 10 点前顺光、人少，预留 1.5 小时。', ['n-photo'], {
        aliases: { strong: ['白墙机位', '海西白墙', '白墙'], weak: ['机位', '拍照点', '网红'] },
      }),
      act('d2-lunch', '11:40', '午餐：喜洲粑粑（老街现烤）', '喜洲古镇', 'food', food(50), '12 点前到，排队较短。', ['n-food', 'c-xizhou']),
      act('d2-xizhou', '13:00', '喜洲古镇 + 麦田散步', '喜洲古镇', 'spot', 0, '古镇和麦田相连，午后顺路。', ['n-route', 'n-photo']),
      act('d2-dinner', '18:00', '回古城晚餐', '大理古城', 'food', food(80), '晚上可自由活动。', ['n-food']),
      act('d2-stay', '21:00', '住人民路白族小院', '大理古城', 'stay', stay(220), '第 2 晚。', ['n-stay-dali']),
    ],
  };

  const d3: DayPlan = {
    id: 'day-cangshan',
    day: 3,
    title: '三塔与苍山',
    area: '大理古城周边',
    summary: '上午三塔顺光，下午苍山索道。',
    activities: [
      act('d3-pagoda', '09:00', '崇圣寺三塔', '崇圣寺三塔', 'spot', 75, '上午顺光，可坐观光车。', ['n-pagoda']),
      act('d3-lunch', '12:00', '午餐：烤饵块 + 米线', '大理古城', 'food', food(40), '', ['n-food']),
      act('d3-cable', '14:00', '苍山洗马潭索道', '苍山洗马潭', 'spot', 280, '山顶温度低，带外套。', ['n-cangshan'], {
        status: 'pending',
        statusNote: '需提前 1–3 天线上预约，尚未预约',
        aliases: { strong: ['苍山', '洗马潭', '索道'] },
      }),
      act('d3-dinner', '18:30', '晚餐：古城私房菜', '大理古城', 'food', food(90), '', ['n-food']),
      act('d3-stay', '21:00', '住人民路白族小院', '大理古城', 'stay', stay(220), '第 3 晚。', ['n-stay-dali']),
    ],
  };

  const d4: DayPlan = {
    id: 'day-lijiang',
    day: 4,
    title: '动车去丽江 · 古城日落',
    area: '丽江古城',
    summary: '上午动车到丽江，下午木府，傍晚狮子山。',
    activities: [
      act('d4-train', '09:30', '动车 大理 → 丽江（约 2 小时）', '大理站', 'transport', 70, '单向前进，不回大理。', ['n-transport', 'n-route']),
      act('d4-stay', '12:30', '入住丽江古城外围客栈', '丽江古城', 'stay', stay(240), '外围步行 10 分钟进古城，避开酒吧街。', ['c-stay-lijiang', 'n-pit'], {
        status: 'pending',
        statusNote: '具体客栈尚未选定',
        aliases: { strong: ['丽江古城', '客栈', '酒吧街'] },
      }),
      act('d4-mufu', '14:30', '丽江古城 + 木府', '丽江古城', 'spot', 60, '避开银器店强推，低价一日游不参加。', ['n-lijiang', 'n-pit']),
      act('d4-sunset', '18:30', '狮子山看古城日落', '狮子山', 'spot', 0, '日落约 19:30（演示数据）。', ['n-lijiang']),
      act('d4-dinner', '20:00', '晚餐：纳西烤鱼', '丽江古城', 'food', food(100), '', ['n-food']),
    ],
  };

  const dSnow: DayPlan = {
    id: 'day-snow',
    day: 5,
    title: '玉龙雪山 · 蓝月谷',
    area: '丽江北部',
    summary: '加一天给雪山，节奏放慢。',
    activities: [
      act('dx-car', '07:30', '包车前往玉龙雪山', '丽江古城', 'transport', 120, '', ['n-transport']),
      act('dx-snow', '09:00', '玉龙雪山 + 蓝月谷', '玉龙雪山', 'spot', 280, '收藏中无详细攻略，按通用安排处理。', ['n-route'], {
        status: 'pending',
        statusNote: '门票与索道需提前预约（收藏中信息不足）',
      }),
      act('dx-lunch', '13:00', '午餐：景区附近简餐', '玉龙雪山', 'food', food(50), '', []),
      act('dx-dinner', '19:00', '晚餐：鸡豆凉粉 + 小吃', '丽江古城', 'food', food(70), '', ['n-food']),
      act('dx-stay', '21:00', '住丽江古城外围客栈', '丽江古城', 'stay', stay(240), '第 2 晚。', ['c-stay-lijiang']),
    ],
  };

  const d5: DayPlan = {
    id: 'day-return',
    day: 5,
    title: '束河慢逛 · 返程',
    area: '束河古镇',
    summary: '束河离机场更近，午饭后返程。',
    activities: [
      act('d5-shuhe', '09:00', '束河古镇慢逛', '束河古镇', 'spot', 0, '上午人少。', ['n-shuhe']),
      act('d5-lunch', '12:00', '午餐：鸡豆凉粉 + 鲜花饼', '束河古镇', 'food', food(60), '', ['n-food']),
      act('d5-back', '14:30', '前往丽江机场/车站返程', '丽江机场', 'transport', 25, '往返大交通不计入本预算。', ['n-shuhe']),
    ],
  };

  const list = days === 4 ? [d1, d2, d4, d5] : days === 6 ? [d1, d2, d3, d4, dSnow, d5] : [d1, d2, d3, d4, d5];
  return list.map((d, i) => ({ ...d, day: i + 1 }));
}

export function generatePlan(params: PlanParams, at: string): Plan {
  const f = Math.min(1.5, Math.max(0.7, params.budget / 3000));
  const dayPlans = buildDays(f, params.days);
  const todos: Todo[] = [
    { id: 't-train', text: '购买大理 → 丽江动车票', done: false, day: dayPlans.find((d) => d.id === 'day-lijiang')?.day },
    { id: 't-stay', text: '预订大理古城小院（3 晚）', done: false, day: 1 },
    { id: 't-car', text: '联系洱海西岸包车司机', done: false, day: 2 },
    { id: 't-coat', text: '准备外套（山顶/早晚温差大）', done: false },
  ];
  if (dayPlans.some((d) => d.id === 'day-cangshan')) {
    todos.splice(2, 0, { id: 't-cable', text: '提前预约苍山洗马潭索道', done: false, day: 3 });
  }
  const notes = [
    params.prefs.includes('少走回头路') ? '路线采用「大理进、丽江出」，全程单向不折返。' : '路线以收藏笔记中的大理 → 丽江顺序为主。',
    '景点、住宿和餐饮均优先选用收藏夹中出现过的内容，并标注来源。',
    params.prefs.includes('美食') ? '每天至少安排一顿收藏里的本地美食。' : '餐饮以顺路为主，不额外绕路。',
    params.prefs.includes('轻松节奏') ? '每天主要活动不超过 3 个，下午留出休息时间。' : '收藏中的避坑提醒已写入对应日期的注意事项。',
  ];
  return {
    id: 'plan-yunnan',
    name: `我的云南${['', '', '', '', '四', '五', '六'][params.days]}日游`,
    days: params.days,
    budget: params.budget,
    people: params.people,
    startDate: params.startDate,
    prefs: params.prefs,
    request: params.request,
    notes,
    dayPlans,
    todos,
    changes: [],
    version: 1,
    createdAt: at,
    updatedAt: at,
  };
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
