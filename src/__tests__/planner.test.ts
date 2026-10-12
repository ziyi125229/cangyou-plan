import { describe, expect, it } from 'vitest';
import { INITIAL_COLLECTION } from '../data/collection';
import { DEFAULT_PARAMS, budgetBreakdown, dayDate, fmtDate, generatePlan, planName, understandCollection, validatePlan, type PlanParams } from '../logic/planner';
import type { Plan } from '../types';

const gen = (p: Partial<PlanParams> = {}) => generatePlan({ ...DEFAULT_PARAMS, ...p }, '1/1 00:00:00');
const acts = (plan: Plan) => plan.dayPlans.flatMap((d) => d.activities);
const dayOfAct = (plan: Plan, id: string) => plan.dayPlans.find((d) => d.activities.some((a) => a.id === id))?.day;

describe('行程一致性', () => {
  it.each([4, 5, 6])('%i 日游通过一致性校验', (days) => {
    const plan = gen({ days });
    expect(validatePlan(plan)).toEqual([]);
    expect(plan.dayPlans.map((d) => d.day)).toEqual(Array.from({ length: days }, (_, i) => i + 1));
    expect(acts(plan).filter((a) => a.kind === 'stay')).toHaveLength(days - 1);
  });

  it('名称随天数变化', () => {
    expect(gen({ days: 4 }).name).toBe('我的云南四日游');
    expect(gen({ days: 5 }).name).toBe('我的云南五日游');
    expect(gen({ days: 6 }).name).toBe('我的云南六日游');
    expect(planName(6)).toBe('我的云南六日游');
  });

  it('非法天数回退为 5 天', () => {
    expect(gen({ days: 9 }).days).toBe(5);
    expect(validatePlan(gen({ days: 9 }))).toEqual([]);
  });

  it('最后一天是返程，返程后没有其他安排', () => {
    for (const days of [4, 5, 6]) {
      const plan = gen({ days });
      const last = plan.dayPlans[days - 1];
      expect(last.activities.at(-1)?.id).toBe('return-back');
      expect(last.activities.some((a) => a.kind === 'stay')).toBe(false);
    }
  });

  it('住宿晚数与标题一致', () => {
    const p4 = gen({ days: 4 });
    expect(acts(p4).find((a) => a.id === 'dali-stay')?.title).toContain('共 2 晚');
    expect(acts(p4).find((a) => a.id === 'lijiang-stay')?.title).toContain('共 1 晚');
    const p6 = gen({ days: 6 });
    expect(acts(p6).find((a) => a.id === 'dali-stay')?.title).toContain('共 3 晚');
    expect(acts(p6).find((a) => a.id === 'lijiang-stay')?.title).toContain('共 2 晚');
    expect(acts(p6).find((a) => a.id === 'lijiang-stay-2')?.title).toContain('第 2 晚');
  });

  it('6 日游雪山在第 5 天，且丽江连住两晚', () => {
    const plan = gen({ days: 6 });
    expect(dayOfAct(plan, 'snow-park')).toBe(5);
    expect(dayOfAct(plan, 'lijiang-train')).toBe(4);
    expect(plan.dayPlans[4].activities.some((a) => a.id === 'lijiang-stay-2')).toBe(true);
  });

  it('没有来源的雪山安排不伪造来源', () => {
    const snow = acts(gen({ days: 6 })).find((a) => a.id === 'snow-park')!;
    expect(snow.sourceIds).toEqual([]);
    expect(snow.status).toBe('pending');
  });

  it('所有 sourceIds 都指向收藏夹中真实存在的内容', () => {
    const ids = new Set(INITIAL_COLLECTION.items.map((i) => i.id));
    for (const days of [4, 5, 6]) for (const a of acts(gen({ days }))) for (const s of a.sourceIds) expect(ids.has(s)).toBe(true);
  });
});

describe('日期', () => {
  it('按出发日期推算每天日期，跨月正确', () => {
    const plan = gen({ days: 6, startDate: '2026-11-28' });
    expect(fmtDate(dayDate(plan, 1))).toBe('11/28');
    expect(fmtDate(dayDate(plan, 3))).toBe('11/30');
    expect(fmtDate(dayDate(plan, 4))).toBe('12/1');
    expect(fmtDate(dayDate(plan, 6))).toBe('12/3');
  });

  it('跨年', () => {
    const plan = gen({ days: 4, startDate: '2026-12-30' });
    expect(fmtDate(dayDate(plan, 4))).toBe('1/2');
  });
});

describe('预算', () => {
  it.each([4, 5, 6])('%i 日游分项之和 = 已用，余量 = 预算 - 已用', (days) => {
    const plan = gen({ days });
    const { lines, used, reserve } = budgetBreakdown(plan);
    expect(lines.reduce((s, l) => s + l.amount, 0)).toBe(used);
    expect(used).toBe(acts(plan).reduce((s, a) => s + a.cost, 0));
    expect(reserve).toBe(plan.budget - used);
  });

  it('天数越多花费越高；预算越高住宿档位越高', () => {
    const used = (p: Partial<PlanParams>) => budgetBreakdown(gen(p)).used;
    expect(used({ days: 4 })).toBeLessThan(used({ days: 5 }));
    expect(used({ days: 5 })).toBeLessThan(used({ days: 6 }));
    const stay = (budget: number) => acts(gen({ budget })).find((a) => a.id === 'dali-stay')!.cost;
    expect(stay(4500)).toBeGreaterThan(stay(3000));
    expect(stay(1500)).toBeLessThan(stay(3000));
  });
});

describe('待办基于最终日程', () => {
  const todo = (plan: Plan, id: string) => plan.todos.find((t) => t.id === id);

  it('索道待办只在含苍山的行程中出现', () => {
    expect(todo(gen({ days: 4 }), 't-cable')).toBeUndefined();
    expect(todo(gen({ days: 5 }), 't-cable')?.day).toBe(3);
  });

  it('雪山待办只在 6 日游，日期为雪山当天', () => {
    expect(todo(gen({ days: 5 }), 't-snow')).toBeUndefined();
    expect(todo(gen({ days: 6 }), 't-snow')?.day).toBe(5);
  });

  it.each([4, 5, 6])('%i 日游动车与丽江订房待办落在去丽江当天，晚数正确', (days) => {
    const plan = gen({ days });
    const lj = dayOfAct(plan, 'lijiang-train');
    expect(todo(plan, 't-train')?.day).toBe(lj);
    expect(todo(plan, 't-stay-lijiang')?.day).toBe(lj);
    const daliNights = acts(plan).filter((a) => a.id.startsWith('dali-stay')).length;
    const ljNights = acts(plan).filter((a) => a.id.startsWith('lijiang-stay')).length;
    expect(daliNights + ljNights).toBe(days - 1);
    expect(todo(plan, 't-stay-dali')?.text).toContain(`${daliNights} 晚`);
    expect(todo(plan, 't-stay-lijiang')?.text).toContain(`${ljNights} 晚`);
  });
});

describe('收藏理解（可解释性）', () => {
  const items = INITIAL_COLLECTION.items;
  const ids = new Set(items.map((i) => i.id));

  it('来源全部真实存在，等级与来源数量一致', () => {
    const u = understandCollection(items, { days: 5 });
    for (const list of [u.spots, u.stays, u.foods, u.routes, u.risks, u.gaps]) {
      for (const ins of list) {
        ins.sourceIds.forEach((s) => expect(ids.has(s)).toBe(true));
        if (list === u.gaps) continue;
        expect(ins.level).toBe(ins.sourceIds.length >= 2 ? 'multi' : 'single');
      }
    }
  });

  it('6 日游提示雪山缺少来源，5 日游不提示', () => {
    const snow = (days: number) => understandCollection(items, { days }).gaps.find((g) => g.label === '玉龙雪山');
    expect(snow(5)).toBeUndefined();
    expect(snow(6)?.sourceIds).toEqual([]);
    expect(snow(6)?.level).toBe('insufficient');
  });

  it('未识别出实体的评论归入「信息不足」，来源指向评论本身', () => {
    const extra = { ...items[0], id: 'c-x', title: '评论补充：随便说说', entities: {} };
    const gap = understandCollection([...items, extra]).gaps.find((g) => g.sourceIds.includes('c-x'));
    expect(gap?.level).toBe('insufficient');
    expect(gap?.label).toBe('评论：随便说说');
  });
});
