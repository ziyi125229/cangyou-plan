import { describe, expect, it } from 'vitest';
import { analyzeImpact } from '../logic/impact';
import { DEFAULT_PARAMS, validatePlan } from '../logic/planner';
import { commentOrigin, contextNote } from '../logic/source';
import { initialState, migrate, reducer, type Action, type State } from '../store';

const run = (s: State, ...actions: Action[]) => actions.reduce(reducer, s);
const at = '1/1 00:00:00';
const gen = (days = 5, extra: Partial<typeof DEFAULT_PARAMS> = {}): Action => ({ type: 'generate', params: { ...DEFAULT_PARAMS, days, ...extra }, at });

/** 生成计划 → 收藏装修评论 → 选替换方案 → 确认更新 → 勾选待办 → 手动确认一项 */
function withHistory() {
  let s = run(initialState(), gen(5));
  s = run(s, { type: 'collect', presetId: 'preset-shop', at, goImpact: true });
  s = run(s, { type: 'draft', draft: { itemId: 'c-preset-shop', activityId: 'arrive-dinner', option: 'replace', altId: 'erhai-home', analyzed: true } });
  s = run(s, { type: 'apply', at }, { type: 'toggleTodo', id: 't-car' }, { type: 'confirmActivity', id: 'cangshan-cable' });
  return s;
}

describe('评论影响分析', () => {
  const s = run(initialState(), gen(5));
  const note = s.collection.items.find((i) => i.id === 'n-fish');
  const text = '这家店最近在装修，老板说要装修1个月，得11月底才重新营业，不要跑空。';

  it('「这家店」结合来源笔记命中 Day 1 晚餐，行程在恢复营业前', () => {
    const r = analyzeImpact(text, s.plan, note);
    expect(r.kind).toBe('matched');
    expect(r.activity?.id).toBe('arrive-dinner');
    expect(r.resolved?.subject).toContain('阿鹏酸辣鱼');
    expect(r.timing?.within).toBe(true);
  });

  it('出发日期在 12 月时判断为已恢复营业', () => {
    const later = run(initialState(), gen(5, { startDate: '2026-12-05' }));
    expect(analyzeImpact(text, later.plan, note).timing?.within).toBe(false);
  });
});

describe('确认更新与撤销', () => {
  it('应用后撤销恢复原安排', () => {
    const before = run(initialState(), gen(5)).plan!;
    const s = withHistory();
    expect(s.plan!.changes).toHaveLength(1);
    expect(s.plan!.dayPlans[0].activities.find((a) => a.id === 'arrive-dinner')!.title).not.toBe(
      before.dayPlans[0].activities.find((a) => a.id === 'arrive-dinner')!.title,
    );
    const u = run(s, { type: 'undo', at });
    expect(u.plan!.dayPlans).toEqual(before.dayPlans);
    expect(u.plan!.changes[0].undone).toBe(true);
    expect(validatePlan(u.plan!)).toEqual([]);
  });

  it('丽江订房细化保留晚数信息', () => {
    let s = run(initialState(), gen(6));
    s = run(s, { type: 'draft', draft: { itemId: 'c-stay-lijiang', activityId: 'lijiang-stay', option: 'add_note', altId: null, analyzed: true } });
    s = run(s, { type: 'apply', at });
    const stay = s.plan!.dayPlans.flatMap((d) => d.activities).find((a) => a.id === 'lijiang-stay')!;
    expect(stay.title).toContain('共 2 晚');
    expect(stay.title).toContain('避开酒吧街');
  });
});

describe('单独收藏其他帖子下的评论', () => {
  const ext = (id: string, s = run(initialState(), gen(5))) => run(s, { type: 'collectExternal', presetId: id, at });
  const item = (s: State, id: string) => s.collection.items.find((i) => i.id === `c-${id}`)!;

  it('保存评论正文、原帖信息与来源类型，不挂到任何收藏笔记上', () => {
    const s = ext('ext-afish');
    const c = item(s, 'ext-afish');
    expect(c.commentSource).toBe('external_post');
    expect(c.sourcePost?.title).toBe('大理古城吃了 5 天，这几家我愿意再去');
    expect(c.sourcePost?.author).toBe('吃遍云南的阿宁');
    expect(c.body[0]).toContain('阿鹏酸辣鱼古城店');
    expect(c.fromNoteId).toBeUndefined();
    expect(s.collection.items.some((i) => i.id === c.sourcePost?.id)).toBe(false);
    expect(commentOrigin(c, s.collection.items).kind).toBe('external_post');
    expect(contextNote(c, s.collection.items)).toBeUndefined();
    expect(c.impact).toBe('unchecked');
    expect(s.view).toEqual(run(initialState(), gen(5)).view);
    expect(s.toast?.text).toBe('已收藏到云南旅行');
  });

  it('重复收藏不会新增', () => {
    const once = ext('ext-afish');
    const twice = ext('ext-afish', once);
    expect(twice.collection.items).toHaveLength(once.collection.items.length);
  });

  it('没有计划时收藏，状态为无需检查', () => {
    const s = run(initialState(), { type: 'collectExternal', presetId: 'ext-cable', at });
    expect(item(s, 'ext-cable').impact).toBe('none');
  });

  it('点名店铺的评论无需指代也能定位到行程', () => {
    const s = ext('ext-afish');
    const c = item(s, 'ext-afish');
    const r = analyzeImpact(c.body[0], s.plan, contextNote(c, s.collection.items));
    expect(r.kind).toBe('matched');
    expect(r.activity?.id).toBe('arrive-dinner');
    expect(r.resolved).toBeUndefined();
  });

  it('景点暂停开放的评论比对行程日期', () => {
    const s = ext('ext-cable');
    const c = item(s, 'ext-cable');
    const r = analyzeImpact(c.body[0], s.plan, contextNote(c, s.collection.items));
    expect(r.activity?.id).toBe('cangshan-cable');
    expect(r.timing?.within).toBe(true);
  });

  it('「这家店」没有来源笔记时不做指代解析，也不伪造定位', () => {
    const s = ext('ext-vague');
    const c = item(s, 'ext-vague');
    const r = analyzeImpact(c.body[0], s.plan, contextNote(c, s.collection.items));
    expect(r.resolved).toBeUndefined();
    expect(r.activity).toBeUndefined();
    expect(r.kind).toBe('ambiguous');
  });

  it('应用、变更原因与撤销', () => {
    let s = ext('ext-afish');
    const before = s.plan!.dayPlans;
    s = run(s, { type: 'draft', draft: { itemId: 'c-ext-afish', activityId: 'arrive-dinner', option: 'replace', altId: 'erhai-home', analyzed: true } });
    s = run(s, { type: 'apply', at });
    expect(s.plan!.changes[0].reason).toContain('帖子「大理古城吃了 5 天，这几家我愿意再去」下单独收藏的评论');
    expect(s.plan!.changes[0].reason).not.toContain('收藏笔记');
    s = run(s, { type: 'undo', at });
    expect(s.plan!.dayPlans).toEqual(before);
  });

  it('旧数据（无 commentSource）按 fromNoteId 识别为收藏笔记评论', () => {
    const s = run(initialState(), { type: 'collect', presetId: 'preset-shop', at });
    const c = { ...s.collection.items.find((i) => i.id === 'c-preset-shop')!, commentSource: undefined };
    expect(commentOrigin(c, s.collection.items).kind).toBe('collected_note');
  });

  it('重新生成后单独收藏的评论保留', () => {
    const s = run(ext('ext-cable'), gen(6));
    const c = item(s, 'ext-cable');
    expect(c.commentSource).toBe('external_post');
    expect(c.impact).toBe('unchecked');
  });
});

describe('重新生成', () => {
  it('不继承变更记录、手动确认与待办进度', () => {
    const s = run(withHistory(), gen(6, { budget: 4000, startDate: '2026-12-01' }));
    const p = s.plan!;
    expect(p.changes).toEqual([]);
    expect(p.version).toBe(1);
    expect(p.days).toBe(6);
    expect(p.budget).toBe(4000);
    expect(p.startDate).toBe('2026-12-01');
    expect(p.todos.every((t) => !t.done)).toBe(true);
    expect(p.dayPlans.flatMap((d) => d.activities).some((a) => a.userConfirmed || a.changed || a.changeSource)).toBe(false);
    expect(validatePlan(p)).toEqual([]);
    expect(s.draft).toBeNull();
  });

  it('收藏与评论补充全部保留，状态按新计划重算', () => {
    const old = withHistory();
    const s = run(old, gen(4));
    expect(s.collection.items.map((i) => i.id)).toEqual(old.collection.items.map((i) => i.id));
    const shop = s.collection.items.find((i) => i.id === 'c-preset-shop')!;
    expect(old.collection.items.find((i) => i.id === 'c-preset-shop')!.impact).toBe('applied');
    expect(shop.impact).toBe('unchecked');
    expect(shop.inPlan).toBe(false);
    const used = new Set(s.plan!.dayPlans.flatMap((d) => d.activities.flatMap((a) => a.sourceIds)));
    for (const i of s.collection.items) expect(i.inPlan).toBe(used.has(i.id));
    expect(s.collection.items.find((i) => i.id === 'n-cangshan')!.inPlan).toBe(false);
  });

  it('未 dispatch generate 时状态不变（取消重新生成）', () => {
    const s = withHistory();
    const after = run(s, { type: 'overlay', overlay: { kind: 'ai' } }, { type: 'overlay', overlay: null });
    expect(after.plan).toBe(s.plan);
    expect(after.collection).toBe(s.collection);
  });

  it('旧版本 Day 编号 id 的计划会按原参数迁移', () => {
    const s = run(initialState(), gen(5));
    const legacy: State = {
      ...s,
      plan: { ...s.plan!, dayPlans: s.plan!.dayPlans.map((d) => ({ ...d, activities: d.activities.map((a) => ({ ...a, id: `d${d.day}-${a.id}` })) })) },
    };
    const m = migrate(legacy);
    expect(validatePlan(m.plan!)).toEqual([]);
    expect(m.plan!.days).toBe(5);
    expect(m.collection.items).toHaveLength(s.collection.items.length);
  });
});
