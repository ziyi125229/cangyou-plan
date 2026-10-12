import type { Activity, ActKind, ChangeRecord, CollectionItem, DayPlan, OptionId, Plan, Todo } from '../types';
import { dayDate } from './planner';

export const RISK_WORDS = ['装修', '关闭', '进不去', '闭园', '暂停开放', '暂停营业', '封闭', '施工', '维修', '停业', '跑空', '不营业'];
const DEIXIS = /这家店|这家|这个店|这店|这里|这个地方|这个机位/;

export interface Alternative {
  id: string;
  title: string;
  place: string;
  time: string;
  cost: number;
  recommended?: boolean;
  fromItemId?: string;
  reasons: string[];
  tradeoff: string;
  routeImpact: string;
  adjust: { id: string; time?: string; title?: string; note: string }[];
}

/** 预置替代方案（演示数据，非实时地理计算） */
export const ALTERNATIVES: Record<string, Alternative[]> = {
  'arrive-dinner': [
    {
      id: 'erhai-home',
      title: '晚餐：洱海人家白族菜',
      place: '洱海人家白族菜（古城店）',
      time: '18:30',
      cost: 80,
      recommended: true,
      fromItemId: 'n-food',
      reasons: [
        '来自你收藏的「云南美食合集」，同样主打白族酸辣鱼',
        '同在古城内，步行约 8 分钟（演示数据），饭后散步不受影响',
        '人均相近，当日预算基本不变',
      ],
      tradeoff: '收藏中只有一篇笔记提到它，口碑参考较少',
      routeImpact: '仍在古城内，路线不变',
      adjust: [],
    },
    {
      id: 'alley',
      title: '晚餐：古城巷子私房菜',
      place: '古城巷子私房菜',
      time: '18:30',
      cost: 70,
      fromItemId: 'n-food',
      reasons: ['收藏笔记提到「往巷子里走，价格更友好」', '离人民路住处更近，第一天少走路'],
      tradeoff: '不是酸辣鱼专门店',
      routeImpact: '仍在古城内，路线不变',
      adjust: [],
    },
  ],
  'erhai-photo': [
    {
      id: 'caicun',
      title: '才村码头 · 洱海边拍照',
      place: '才村码头',
      time: '09:30',
      cost: 0,
      recommended: true,
      reasons: [
        '同在洱海西岸，与原机位同一条包车路线（演示数据）',
        '开放式湖岸，不依赖单一场所是否开放',
        '离古城更近，可晚出发 30 分钟，中午仍能到喜洲',
      ],
      tradeoff: '没有白墙背景，画面偏自然水景',
      routeImpact: '路线顺序不变，往喜洲方向多约 20 分钟车程',
      adjust: [
        { id: 'erhai-car', time: '09:00', note: '出发推迟 30 分钟' },
        { id: 'erhai-lunch', time: '12:00', note: '午餐推迟 20 分钟' },
      ],
    },
    {
      id: 'field',
      title: '喜洲麦田 · 田间拍照',
      place: '喜洲麦田',
      time: '10:00',
      cost: 0,
      fromItemId: 'n-photo',
      reasons: ['来自你收藏的「洱海西岸 3 个出片机位」', '与午餐、喜洲古镇同一区域，零折返'],
      tradeoff: '画面受季节影响较大',
      routeImpact: '直接前往喜洲，路线更短',
      adjust: [
        { id: 'erhai-car', time: '09:00', note: '出发推迟 30 分钟' },
        { id: 'erhai-xizhou', title: '喜洲古镇 · 严家大院', note: '麦田已提前到上午，下午只逛古镇' },
      ],
    },
  ],
};

const CN: Record<string, number> = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 十二: 12, 半: 0.5 };
const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : CN[s] ?? NaN);

export interface Timing {
  duration?: string;
  reopenLabel?: string;
  reopenDate?: Date;
  activityDate: Date;
  /** 行程日期是否落在预计恢复之前 */
  within: boolean | null;
}

/** 从评论中提取「装修多久 / 何时恢复」，并与行程日期比较 */
export function parseTiming(text: string, activityDate: Date): Timing | null {
  const dur = text.match(/(\d+|[一两二三半])\s*(个月|个多月|周|个星期|天)/);
  const re = text.match(/(十一|十二|\d{1,2}|[一二三四五六七八九十])\s*月\s*(底|初|中旬|上旬|下旬|中|(\d{1,2})\s*[日号])/);
  if (!dur && !re) return null;
  const t: Timing = { activityDate, within: null };
  if (dur) t.duration = `${dur[1]}${dur[2]}`;
  if (re) {
    const m = num(re[1]);
    const y = activityDate.getFullYear();
    const last = new Date(y, m, 0).getDate();
    const day = re[3] ? Number(re[3]) : /底|下旬/.test(re[2]) ? last : /初|上旬/.test(re[2]) ? 5 : 15;
    t.reopenLabel = `${m} 月${re[3] ? `${re[3]} 日` : re[2]}`;
    t.reopenDate = new Date(y, m - 1, day);
    t.within = activityDate < t.reopenDate;
  }
  return t;
}

export type ImpactKind = 'matched' | 'ambiguous' | 'info' | 'none' | 'no_plan';

export interface ImpactResult {
  kind: ImpactKind;
  riskWords: string[];
  matchedWords: string[];
  /** 评论中的指代（如「这家店」）结合来源笔记解析出的对象 */
  resolved?: { phrase: string; subject: string };
  timing?: Timing | null;
  day?: DayPlan;
  activity?: Activity;
  adjacent: Activity[];
  unaffectedConfirmed: number;
}

export function analyzeImpact(text: string, plan: Plan | null, sourceNote?: CollectionItem): ImpactResult {
  const riskWords = RISK_WORDS.filter((w) => text.includes(w));
  const empty: ImpactResult = { kind: 'none', riskWords, matchedWords: [], adjacent: [], unaffectedConfirmed: 0 };
  if (!plan) return { ...empty, kind: 'no_plan' };

  const deixis = text.match(DEIXIS)?.[0];
  const resolved = deixis && sourceNote?.subject ? { phrase: deixis, subject: sourceNote.subject } : undefined;
  const haystack = resolved ? `${text} ${resolved.subject}` : text;

  const find = (level: 'strong' | 'weak') => {
    for (const day of plan.dayPlans) {
      for (const a of day.activities) {
        const words = (level === 'strong' ? a.aliases?.strong : a.aliases?.weak) ?? [];
        const hit = words.filter((w) => haystack.includes(w)).filter((w, _, arr) => !arr.some((o) => o !== w && o.includes(w)));
        if (hit.length) return { day, activity: a, hit };
      }
    }
    return null;
  };

  const strong = find('strong');
  const weak = strong ? null : find('weak');
  const m = strong ?? weak;
  if (!m) return riskWords.length ? { ...empty, kind: 'ambiguous', resolved } : { ...empty, resolved };

  const idx = m.day.activities.findIndex((a) => a.id === m.activity.id);
  const adjacent = [m.day.activities[idx - 1], m.day.activities[idx + 1]].filter(Boolean) as Activity[];
  const affectedIds = new Set([m.activity.id, ...adjacent.map((a) => a.id)]);
  const unaffectedConfirmed = plan.dayPlans
    .flatMap((d) => d.activities)
    .filter((a) => a.status === 'confirmed' && !affectedIds.has(a.id)).length;

  let kind: ImpactKind;
  if (!riskWords.length) kind = 'info';
  else kind = strong ? 'matched' : 'ambiguous';
  const timing = parseTiming(text, dayDate(plan, m.day.day));
  return { kind, riskWords, matchedWords: m.hit, resolved, timing, day: m.day, activity: m.activity, adjacent, unaffectedConfirmed };
}

export function riskSentence(kind: ActKind) {
  return kind === 'food' ? '到店可能无法用餐，白跑一趟' : '到达后可能无法进入';
}

/** 补充建议型评论：按评论内容细化原安排（预置规则） */
export const REFINEMENTS: Record<
  string,
  { label: string; desc: string; title: (orig: string) => string; detail: string; statusNote?: string; todo: string }
> = {
  'lijiang-stay': {
    label: '按评论调整订房要求',
    desc: '把「避开酒吧街」写进住宿安排，并生成订房待办',
    title: (orig) => orig.replace('外围客栈', '外围客栈·避开酒吧街一带'),
    detail: '评论区提醒酒吧街夜间很吵；选北侧或西侧外围，步行 10 分钟进古城（演示数据）。',
    statusNote: '具体客栈尚未选定 · 订房时避开酒吧街附近',
    todo: '预订丽江客栈：古城外围、远离酒吧街',
  },
};

export function optionLabel(option: OptionId, kind?: ActKind, activityId?: string) {
  if (option === 'replace') return kind === 'food' ? '更换为收藏里的其他餐厅' : '更换为附近的替代地点';
  if (option === 'add_note') return (activityId && REFINEMENTS[activityId]?.label) || '把评论写进当日安排';
  return { mark_pending: '暂时标记为待确认', keep: '保留原计划，出发前再次核实' }[option];
}

const STATUS_LABEL = { confirmed: '已确认', pending: '待确认', risk: '有风险' } as const;

export interface FieldDiff {
  label: string;
  from?: string;
  to?: string;
}

/** 逐字段对比一项安排的变化 */
export function diffActivity(b: Activity, a: Activity): FieldDiff[] {
  const out: FieldDiff[] = [];
  if (b.time !== a.time) out.push({ label: '时间', from: b.time, to: a.time });
  if (b.title !== a.title) out.push({ label: '安排', from: b.title, to: a.title });
  if (b.status !== a.status) out.push({ label: '状态', from: STATUS_LABEL[b.status], to: STATUS_LABEL[a.status] });
  if ((b.statusNote ?? '') !== (a.statusNote ?? '')) out.push({ label: '备注', from: b.statusNote, to: a.statusNote ?? '（移除）' });
  if ((b.tip ?? '') !== (a.tip ?? '')) out.push({ label: '评论提醒', to: a.tip });
  if (b.cost !== a.cost) out.push({ label: '人均', from: `¥${b.cost}`, to: `¥${a.cost}` });
  return out;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export interface ApplyInput {
  plan: Plan;
  item: CollectionItem;
  /** 评论来源描述，如「收藏笔记「…」的评论区」 */
  sourceLabel?: string;
  activityId: string;
  option: OptionId;
  altId?: string | null;
  at: string;
}

/** 生成更新后的计划（纯函数，可用于预览，也用于确认后提交） */
export function applyOption({ plan, item, sourceLabel, activityId, option, altId, at }: ApplyInput): { plan: Plan; record: ChangeRecord } {
  const next = clone(plan);
  const snapshot = clone({ dayPlans: plan.dayPlans, todos: plan.todos, version: plan.version });
  const day = next.dayPlans.find((d) => d.activities.some((a) => a.id === activityId))!;
  const target = day.activities.find((a) => a.id === activityId)!;
  const original = plan.dayPlans.flatMap((d) => d.activities).find((a) => a.id === activityId)!;
  const touchedIds = new Set<string>([activityId]);
  const before = (ids: Set<string>) => plan.dayPlans.flatMap((d) => d.activities).filter((a) => ids.has(a.id));
  const short = target.title;
  const isFood = target.kind === 'food';
  const comment = item.body[0]?.replace(/[「」]/g, '') ?? item.summary;
  const todos: Todo[] = [];
  let title = '';

  if (option === 'replace') {
    const alt = (ALTERNATIVES[activityId] ?? []).find((a) => a.id === altId) ?? ALTERNATIVES[activityId]?.[0];
    if (!alt) throw new Error('no alternative');
    Object.assign(target, {
      title: alt.title,
      place: alt.place,
      time: alt.time,
      cost: alt.cost,
      detail: `替代原「${short}」。${alt.tradeoff}。`,
      status: 'confirmed',
      statusNote: undefined,
      aliases: undefined,
      sourceIds: alt.fromItemId ? [alt.fromItemId, item.id] : [item.id],
      changed: true,
      changeNote: `原：${original.time} ${short}`,
    } satisfies Partial<Activity>);
    for (const adj of alt.adjust) {
      const a = day.activities.find((x) => x.id === adj.id);
      if (!a) continue;
      touchedIds.add(a.id);
      const prev = `${a.time} ${a.title}`;
      if (adj.time) a.time = adj.time;
      if (adj.title) a.title = adj.title;
      a.changed = true;
      a.changeNote = `${adj.note}（原 ${prev}）`;
    }
    day.activities.sort((a, b) => a.time.localeCompare(b.time));
    title = `Day ${day.day}：${short.replace(/^(午餐|晚餐)：/, '')} → ${alt.place}`;
  } else if (option === 'mark_pending') {
    Object.assign(target, {
      status: 'pending',
      statusNote: isFood ? '评论提到店铺在装修，待核实是否营业' : '评论提示可能在装修，待核实后再决定是否前往',
      changed: true,
      changeNote: '由「已确认」改为「待确认」',
    } satisfies Partial<Activity>);
    todos.push({ id: `t-verify-${at}`, text: `核实「${target.place}」${isFood ? '是否正常营业' : '是否开放'}`, done: false, day: day.day, fromChange: at });
    title = `Day ${day.day}：${short} 标记为待确认`;
  } else if (option === 'keep') {
    Object.assign(target, {
      status: 'risk',
      statusNote: `保留原计划；评论提到${isFood ? '店铺' : '该地点'}在装修，出发前再次核实`,
      changed: true,
      changeNote: '安排不变，新增风险提示',
    } satisfies Partial<Activity>);
    todos.push({ id: `t-verify-${at}`, text: `出发前一天核实「${target.place}」${isFood ? '是否营业' : '是否开放'}`, done: false, day: day.day, fromChange: at });
    title = `Day ${day.day}：${short} 保留，出发前核实`;
  } else {
    const r = REFINEMENTS[activityId];
    if (r) {
      Object.assign(target, {
        title: r.title(short),
        detail: r.detail,
        statusNote: r.statusNote ?? target.statusNote,
        tip: comment,
        changed: true,
        changeNote: `原：${short}`,
      } satisfies Partial<Activity>);
      todos.push({ id: `t-note-${at}`, text: r.todo, done: false, day: day.day, fromChange: at });
      title = `Day ${day.day}：${r.label}`;
    } else {
      Object.assign(target, { tip: comment, changed: true, changeNote: '新增一条来自评论区的提醒' } satisfies Partial<Activity>);
      todos.push({ id: `t-note-${at}`, text: `出发前留意：${comment.slice(0, 20)}…`, done: false, day: day.day, fromChange: at });
      title = `Day ${day.day}：${short} 写入评论提醒`;
    }
  }

  target.changeSource = { itemId: item.id, text: comment };
  if (!target.sourceIds.includes(item.id)) target.sourceIds = [...target.sourceIds, item.id];
  day.changeTag = '已更新';
  next.todos = [...next.todos, ...todos];
  next.version = plan.version + 1;
  next.updatedAt = at;

  const oldCost = before(touchedIds).reduce((s, a) => s + a.cost, 0);
  const after = day.activities.filter((a) => touchedIds.has(a.id));
  const newCost = after.reduce((s, a) => s + a.cost, 0);

  const record: ChangeRecord = {
    id: `chg-${at}`,
    at,
    title,
    reason: `${sourceLabel ? `${sourceLabel}提到` : '收藏的评论提到'}：「${comment}」`,
    sourceItemId: item.id,
    sourceText: comment,
    option,
    optionLabel: optionLabel(option, original.kind, activityId),
    day: day.day,
    before: clone(before(touchedIds)),
    after: clone(after),
    addedTodos: todos.map((t) => t.text),
    budgetDelta: newCost - oldCost,
    snapshot,
    undone: false,
  };
  next.changes = [record, ...plan.changes];
  return { plan: next, record };
}

export function undoLast(plan: Plan, at: string): { plan: Plan; record: ChangeRecord } | null {
  const record = plan.changes.find((c) => !c.undone);
  if (!record) return null;
  return {
    record,
    plan: {
      ...plan,
      ...clone(record.snapshot),
      updatedAt: at,
      changes: plan.changes.map((c) => (c.id === record.id ? { ...c, undone: true, undoneAt: at } : c)),
    },
  };
}