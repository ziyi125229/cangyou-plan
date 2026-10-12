import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';
import { EXTERNAL_PRESETS, INFO_PRESETS, INITIAL_COLLECTION } from './data/collection';
import { applyOption, undoLast } from './logic/impact';
import { generatePlan, type PlanParams } from './logic/planner';
import { commentOrigin, originLabel } from './logic/source';
import type { Collection, CollectionItem, Draft, Overlay, Plan, View } from './types';

export interface Toast {
  id: number;
  text: string;
  tone?: 'success' | 'info' | 'warn';
}

export interface Progress {
  aiOpened: boolean;
  analyzed: boolean;
  changelogViewed: boolean;
  undone: boolean;
}

export interface State {
  collection: Collection;
  plan: Plan | null;
  view: View;
  draft: Draft | null;
  overlay: Overlay;
  toast: Toast | null;
  progress: Progress;
  /** 叠在其他弹层之上的笔记预览（如 AI 面板中点开来源） */
  peek: string | null;
}

const STORAGE_KEY = 'cangyou-demo-v3';

export const initialState = (): State => ({
  collection: structuredClone(INITIAL_COLLECTION),
  plan: null,
  view: { name: 'collection' },
  draft: null,
  overlay: null,
  toast: null,
  progress: { aiOpened: false, analyzed: false, changelogViewed: false, undone: false },
  peek: null,
});

export type Action =
  | { type: 'nav'; view: View }
  | { type: 'overlay'; overlay: Overlay }
  | { type: 'peek'; id: string | null }
  | { type: 'toast'; text: string; tone?: Toast['tone'] }
  | { type: 'clearToast'; id: number }
  | { type: 'generate'; params: PlanParams; at: string }
  | { type: 'toggleTodo'; id: string }
  | { type: 'confirmActivity'; id: string }
  | { type: 'collect'; presetId?: string; text?: string; fromNoteId?: string; at: string; goImpact?: boolean }
  | { type: 'collectExternal'; presetId: string; at: string }
  | { type: 'draft'; draft: Partial<Draft> }
  | { type: 'analyzed' }
  | { type: 'apply'; at: string }
  | { type: 'dismiss'; itemId: string }
  | { type: 'undo'; at: string }
  | { type: 'reset' };

let toastSeq = 0;
const withToast = (s: State, text: string, tone: Toast['tone'] = 'success'): State => ({
  ...s,
  toast: { id: ++toastSeq, text, tone },
});

const setItem = (c: Collection, id: string, patch: Partial<CollectionItem>): Collection => ({
  ...c,
  items: c.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
});

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'nav': {
      const progress = { ...s.progress };
      if (a.view.name === 'changelog') progress.changelogViewed = true;
      return { ...s, view: a.view, overlay: null, peek: null, progress };
    }
    case 'peek':
      return { ...s, peek: a.id };
    case 'overlay':
      return {
        ...s,
        overlay: a.overlay,
        progress: a.overlay?.kind === 'ai' ? { ...s.progress, aiOpened: true } : s.progress,
      };
    case 'toast':
      return withToast(s, a.text, a.tone);
    case 'clearToast':
      return s.toast?.id === a.id ? { ...s, toast: null } : s;
    case 'generate': {
      // 新计划不继承旧计划的变更记录、手动确认与待办进度；收藏内容全部保留，状态按新计划重新计算
      const regenerated = !!s.plan;
      const plan = generatePlan(a.params, a.at);
      const used = new Set(plan.dayPlans.flatMap((d) => d.activities.flatMap((x) => x.sourceIds)));
      const collection: Collection = {
        ...s.collection,
        planId: plan.id,
        items: s.collection.items.map((i) => ({
          ...i,
          inPlan: used.has(i.id),
          impact: i.type === 'comment' && !used.has(i.id) ? 'unchecked' : 'none',
        })),
      };
      return withToast(
        { ...s, plan, collection, draft: null, overlay: null, peek: null, view: { name: 'plan', day: 1 } },
        regenerated ? `已重新生成计划，收藏夹 ${s.collection.items.length} 篇收藏均已保留` : `已基于 ${s.collection.items.length} 篇收藏生成计划`,
      );
    }
    case 'toggleTodo': {
      if (!s.plan) return s;
      return { ...s, plan: { ...s.plan, todos: s.plan.todos.map((t) => (t.id === a.id ? { ...t, done: !t.done } : t)) } };
    }
    case 'confirmActivity': {
      if (!s.plan) return s;
      const plan = {
        ...s.plan,
        dayPlans: s.plan.dayPlans.map((d) => ({
          ...d,
          activities: d.activities.map((x) =>
            x.id === a.id ? { ...x, status: 'confirmed' as const, statusNote: undefined, userConfirmed: true } : x,
          ),
        })),
      };
      return withToast({ ...s, plan }, '已标记为已确认');
    }
    case 'collect': {
      const preset = INFO_PRESETS.find((p) => p.id === a.presetId);
      const text = preset?.text ?? a.text?.trim() ?? '';
      if (!text) return s;
      const id = preset ? `c-${preset.id}` : `c-custom-${a.at}`;
      if (s.collection.items.some((i) => i.id === id)) return withToast(s, '这条评论已在收藏夹中', 'info');
      const fromId = preset?.fromNoteId ?? a.fromNoteId;
      const from = s.collection.items.find((i) => i.id === fromId);
      const item: CollectionItem = {
        id,
        title: `评论补充：${text.length > 18 ? text.slice(0, 18) + '…' : text}`,
        type: 'comment',
        category: '评论补充',
        summary: from ? `来自收藏笔记「${from.title.slice(0, 14)}…」的评论区` : '评论区信息（模拟）',
        body: [text],
        author: `评论 · ${preset?.author ?? '模拟评论者'}`,
        likes: String(preset?.likes ?? 0),
        places: [],
        timeInfo: preset?.time ?? '刚刚',
        inPlan: false,
        entities: {},
        cover: { tone: '#7a7f8c', label: '评论补充' },
        fromNoteId: fromId,
        commentSource: from ? 'collected_note' : undefined,
        impact: s.plan ? 'unchecked' : 'none',
        isNew: true,
        savedAt: '刚刚',
      };
      const collection = {
        ...s.collection,
        items: [item, ...s.collection.items.map((i) => ({ ...i, isNew: false }))],
      };
      const view: View = a.goImpact && s.plan ? { name: 'impact', itemId: id } : s.view;
      return withToast({ ...s, collection, overlay: null, peek: null, view }, `已收藏到「${s.collection.name}」`);
    }
    case 'collectExternal': {
      const preset = EXTERNAL_PRESETS.find((p) => p.id === a.presetId);
      if (!preset) return s;
      const id = `c-${preset.id}`;
      if (s.collection.items.some((i) => i.id === id)) return withToast(s, '这条评论已在收藏夹中', 'info');
      const item: CollectionItem = {
        id,
        title: `评论补充：${preset.text.length > 18 ? preset.text.slice(0, 18) + '…' : preset.text}`,
        type: 'comment',
        category: '评论补充',
        summary: `来自帖子「${preset.post.title.slice(0, 14)}…」的评论区（单独收藏的评论）`,
        body: [preset.text],
        author: `评论 · ${preset.author}`,
        likes: String(preset.likes),
        places: [],
        timeInfo: preset.time,
        inPlan: false,
        entities: {},
        cover: { tone: '#7a7f8c', label: '评论补充' },
        commentSource: 'external_post',
        sourcePost: { ...preset.post },
        impact: s.plan ? 'unchecked' : 'none',
        isNew: true,
        savedAt: '刚刚',
      };
      const collection = {
        ...s.collection,
        items: [item, ...s.collection.items.map((i) => ({ ...i, isNew: false }))],
      };
      return withToast({ ...s, collection }, `已收藏到${s.collection.name}`);
    }
    case 'draft': {
      const base: Draft = s.draft ?? { itemId: '', analyzed: false, option: null, altId: null, activityId: null };
      return { ...s, draft: { ...base, ...a.draft } };
    }
    case 'analyzed':
      return s.draft ? { ...s, draft: { ...s.draft, analyzed: true }, progress: { ...s.progress, analyzed: true } } : s;
    case 'apply': {
      const d = s.draft;
      const item = s.collection.items.find((i) => i.id === d?.itemId);
      if (!s.plan || !d || !item || !d.option || !d.activityId) return s;
      const sourceLabel = originLabel(commentOrigin(item, s.collection.items));
      const { plan, record } = applyOption({ plan: s.plan, item, sourceLabel, activityId: d.activityId, option: d.option, altId: d.altId, at: a.at });
      const collection = setItem(s.collection, item.id, { impact: 'applied', inPlan: true });
      return withToast(
        { ...s, plan, collection, draft: null, view: { name: 'plan', day: record.day } },
        `计划已更新：${record.title}`,
      );
    }
    case 'dismiss': {
      const collection = setItem(s.collection, a.itemId, { impact: 'dismissed' });
      return withToast({ ...s, collection, draft: null, view: { name: 'plan' } }, '已保留原计划，这条信息仍在收藏夹中', 'info');
    }
    case 'undo': {
      if (!s.plan) return s;
      const res = undoLast(s.plan, a.at);
      if (!res) return withToast(s, '没有可撤销的更新', 'info');
      const collection = setItem(s.collection, res.record.sourceItemId, { impact: 'unchecked', inPlan: false });
      return withToast(
        { ...s, plan: res.plan, collection, progress: { ...s.progress, undone: true } },
        `已撤销：${res.record.title}`,
        'info',
      );
    }
    case 'reset':
      return withToast(initialState(), '演示已重置', 'info');
  }
}

/** 旧版本按固定 Day 编号命名安排（如 d2-photo），按原参数重建计划，收藏内容保持不变 */
export function migrate(state: State): State {
  const p = state.plan;
  if (!p || !p.dayPlans.some((d) => d.activities.some((x) => /^d[1-5x]-/.test(x.id)))) return state;
  const params: PlanParams = { days: p.days, budget: p.budget, people: p.people, startDate: p.startDate, prefs: p.prefs, request: p.request };
  const next = reducer(state, { type: 'generate', params, at: p.createdAt });
  return { ...next, view: { name: 'plan' }, toast: null };
}

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const saved = JSON.parse(raw) as Partial<State>;
    const state: State = { ...initialState(), ...saved, overlay: null, toast: null, peek: null };
    return migrate(state);
  } catch {
    return initialState();
  }
}

const Ctx = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    const { collection, plan, view, draft, progress } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ collection, plan, view, draft, progress }));
  }, [state]);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider missing');
  return v;
}

export const nowStamp = () => {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};
