import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronDown, ChevronUp, FolderHeart, LoaderCircle, Minus, Plus, RefreshCw, ShieldAlert, Sparkles, TriangleAlert } from 'lucide-react';
import { MockNote, Sheet } from '../components/ui';
import {
  DEFAULT_PARAMS,
  MAX_DAYS,
  MIN_DAYS,
  PREF_OPTIONS,
  dayDate,
  fmtDate,
  parseRequest,
  planName,
  planStats,
  understandCollection,
  type Insight,
  type InsightLevel,
  type PlanParams,
} from '../logic/planner';
import { nowStamp, useStore } from '../store';
import type { CollectionItem } from '../types';

const STAGES = ['正在整理收藏内容', '正在关联景点与路线', '正在生成旅行计划'];

type Quick = 'full' | 'budget' | 'pitfall';
const QUICK: { id: Quick; label: string; desc: string }[] = [
  { id: 'full', label: '综合旅行攻略', desc: '路线 + 住宿 + 美食' },
  { id: 'budget', label: '整理路线与预算', desc: '按天拆分花费' },
  { id: 'pitfall', label: '检查收藏中的避坑信息', desc: '不生成计划' },
];

const LEVEL_TAG: Record<InsightLevel, string> = { multi: '多篇提及', single: '单篇提及', insufficient: '信息不足' };
const GROUP_LIMIT = 4;

function Stepper({ value, onChange, min, max, step, unit }: { value: number; onChange: (n: number) => void; min: number; max: number; step: number; unit: string }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} aria-label="减少">
        <Minus size={14} />
      </button>
      <span>
        {value}
        <small>{unit}</small>
      </span>
      <button onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} aria-label="增加">
        <Plus size={14} />
      </button>
    </div>
  );
}

function Sources({ ids, items }: { ids: string[]; items: CollectionItem[] }) {
  const { dispatch } = useStore();
  const found = ids.map((id) => items.find((i) => i.id === id)).filter(Boolean) as CollectionItem[];
  if (!found.length) return <span className="ins-nosrc">收藏中暂无直接来源</span>;
  return (
    <span className="ins-src">
      {found.map((i) => (
        <button key={i.id} onClick={() => dispatch({ type: 'peek', id: i.id })}>
          《{i.title.replace(/^评论补充：/, '评论：').slice(0, 14)}
          {i.title.length > 14 ? '…' : ''}》
        </button>
      ))}
    </span>
  );
}

function InsightGroup({ title, list, items }: { title: string; list: Insight[]; items: CollectionItem[] }) {
  const [all, setAll] = useState(false);
  if (!list.length) return null;
  const shown = all ? list : list.slice(0, GROUP_LIMIT);
  return (
    <div className="insight">
      <h5>
        {title} <span className="muted">{list.length}</span>
      </h5>
      <ul className="ins-list">
        {shown.map((i) => (
          <li key={i.label} className={`ins-row ins-${i.level}`}>
            <div className="ins-main">
              <b>{i.label}</b>
              <span className={`ins-tag ins-tag-${i.level}`}>
                {LEVEL_TAG[i.level]}
                {i.level === 'multi' && ` · ${i.sourceIds.length} 篇`}
              </span>
            </div>
            {i.reason && <p className="ins-reason">{i.reason}</p>}
            <Sources ids={i.sourceIds} items={items} />
          </li>
        ))}
      </ul>
      {list.length > GROUP_LIMIT && (
        <button className="ins-more" onClick={() => setAll(!all)}>
          {all ? '收起' : `查看全部 ${list.length} 项`} {all ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      )}
    </div>
  );
}

export function AIPanel() {
  const { state, dispatch } = useStore();
  const { collection, plan } = state;
  const [params, setParams] = useState<PlanParams>(
    plan ? { days: plan.days, budget: plan.budget, people: plan.people, startDate: plan.startDate, prefs: plan.prefs, request: plan.request } : DEFAULT_PARAMS,
  );
  const u = useMemo(() => understandCollection(collection.items, { days: params.days }), [collection.items, params.days]);
  const [quick, setQuick] = useState<Quick>('full');
  const [stage, setStage] = useState(-1);
  const [confirming, setConfirming] = useState(false);
  const parsed = useMemo(() => parseRequest(params.request), [params.request]);
  const close = () => stage < 0 && dispatch({ type: 'overlay', overlay: null });

  const setRequest = (request: string) => {
    const p = parseRequest(request);
    setParams((prev) => ({
      ...prev,
      request,
      days: p.days ?? prev.days,
      budget: p.budget ?? prev.budget,
      people: p.people ?? prev.people,
      startDate: p.startDate ?? prev.startDate,
      prefs: p.prefs.length ? [...new Set([...prev.prefs, ...p.prefs])] : prev.prefs,
    }));
  };

  const pickQuick = (q: Quick) => {
    setQuick(q);
    if (q === 'full') setRequest(`帮我规划一份云南${params.days}日游，预算 ${params.budget} 元，尽量不走回头路。`);
    if (q === 'budget') setRequest(`按收藏整理路线，每天的花费拆清楚，控制在 ${params.budget} 元以内。`);
  };

  useEffect(() => {
    if (stage < 0) return;
    if (stage >= STAGES.length) {
      dispatch({ type: 'generate', params, at: nowStamp() });
      return;
    }
    const t = setTimeout(() => setStage((s) => s + 1), 650);
    return () => clearTimeout(t);
  }, [stage, params, dispatch]);

  const generating = stage >= 0;
  const recognized = [
    parsed.days && `${parsed.days} 天`,
    parsed.budget && `预算 ${parsed.budget} 元`,
    parsed.people && `${parsed.people} 人`,
    parsed.startDate && `${Number(parsed.startDate.slice(5, 7))}/${Number(parsed.startDate.slice(8))} 出发`,
    ...parsed.prefs,
  ].filter(Boolean) as string[];

  const groups = [u.spots, u.stays, u.foods, u.routes, u.risks].flat();
  const count = (lv: InsightLevel) => groups.filter((g) => g.level === lv).length + (lv === 'insufficient' ? u.gaps.length : 0);

  const existing = plan
    ? (() => {
        const st = planStats(plan);
        const acts = plan.dayPlans.flatMap((d) => d.activities);
        return {
          ...st,
          manual: acts.filter((a) => a.userConfirmed).length,
          todoDone: plan.todos.filter((t) => t.done).length,
          todoTotal: plan.todos.length,
          changes: plan.changes.length,
          comments: collection.items.filter((i) => i.type === 'comment').length,
        };
      })()
    : null;
  const startStr = (p: { startDate: string }) => fmtDate(dayDate(p, 1));

  return (
    <Sheet
      full
      title="你想用这些收藏完成什么？"
      onClose={close}
      footer={
        generating ? null : quick === 'pitfall' ? (
          <button className="btn btn-primary btn-block" onClick={() => pickQuick('full')}>
            继续设置计划需求
          </button>
        ) : plan ? (
          <div className="foot-row">
            <button className="btn btn-ghost" onClick={() => setConfirming(true)}>
              <RefreshCw size={15} /> 重新生成
            </button>
            <button className="btn btn-primary btn-grow" onClick={() => dispatch({ type: 'nav', view: { name: 'plan' } })}>
              <CalendarDays size={16} /> 继续调整当前计划
            </button>
          </div>
        ) : (
          <button className="btn btn-primary btn-block" onClick={() => setStage(0)}>
            <Sparkles size={16} /> 生成我的计划
          </button>
        )
      }
    >
      <div className="ctx-card">
        <FolderHeart size={20} className="brand" />
        <div>
          <strong>已关联收藏夹「{collection.name}」</strong>
          <small>本次分析 {collection.items.length} 篇收藏（含评论补充），它们将作为本次任务的参考材料</small>
        </div>
      </div>

      {plan && existing && !generating && (
        <div className="existing-plan">
          <div>
            <strong>
              已有计划「{plan.name}」· v{plan.version}
            </strong>
            <small>
              {startStr(plan)} 出发 · 已确认 {existing.confirmed} 项 · 待办 {existing.todoDone}/{existing.todoTotal} · 变更记录 {existing.changes} 条
            </small>
          </div>
          <p>
            「继续调整当前计划」会保留以上全部状态；如果需求变了，可以修改下方需求后选择「重新生成」，确认前不会改动原计划。
          </p>
        </div>
      )}

      {generating ? (
        <div className="stages">
          {STAGES.map((s, i) => (
            <div key={s} className={`stage${i < stage ? ' done' : i === stage ? ' doing' : ''}`}>
              {i < stage ? <Check size={16} /> : i === stage ? <LoaderCircle size={16} className="spin" /> : <span className="dot" />}
              {s}
              {i === 0 && i < stage && <em>{collection.items.length} 篇</em>}
              {i === 1 && i < stage && <em>{u.spots.length} 个景点 · {u.routes.length} 条路线建议</em>}
            </div>
          ))}
          <MockNote kinds={['rule']} />
        </div>
      ) : (
        <>
          <section className="block">
            <h4 className="block-title">AI 对这些收藏的初步理解</h4>
            <div className="ins-summary">
              <span className="ins-tag ins-tag-multi">多篇提及 {count('multi')}</span>
              <span className="ins-tag ins-tag-single">单篇提及 {count('single')}</span>
              <span className="ins-tag ins-tag-insufficient">信息不足 / 待确认 {count('insufficient')}</span>
            </div>
            <p className="muted tiny ins-hint">点击书名号中的收藏可查看原笔记。</p>
            <div className="insights">
              <InsightGroup title="已识别的景点" list={u.spots} items={collection.items} />
              <InsightGroup title="住宿" list={u.stays} items={collection.items} />
              <InsightGroup title="美食" list={u.foods} items={collection.items} />
              <InsightGroup title="路线与游玩建议" list={u.routes} items={collection.items} />
              <InsightGroup title="风险提示" list={u.risks} items={collection.items} />
              <InsightGroup title="信息不足 / 待确认" list={u.gaps} items={collection.items} />
            </div>
            <p className="muted tiny ins-hint">暂不支持自动识别不同收藏之间的内容冲突。</p>
            <MockNote kinds={['content', 'rule']} />
          </section>

          <section className="block">
            <h4 className="block-title">快捷任务</h4>
            <div className="quick-row">
              {QUICK.map((q) => (
                <button key={q.id} className={`quick${quick === q.id ? ' quick-on' : ''}`} onClick={() => pickQuick(q.id)}>
                  <b>{q.label}</b>
                  <small>{q.desc}</small>
                </button>
              ))}
            </div>
          </section>

          {quick === 'pitfall' ? (
            <section className="block">
              <h4 className="block-title">收藏中的避坑与待确认信息</h4>
              <ul className="pit-list">
                {u.risks.map((r) => (
                  <li key={r.label}>
                    <ShieldAlert size={14} />
                    <div>
                      {r.label}
                      <Sources ids={r.sourceIds} items={collection.items} />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="muted tiny">共 {u.risks.length} 条，生成计划时会写入对应日期的注意事项。</p>
            </section>
          ) : (
            <>
              <section className="block">
                <h4 className="block-title">{plan ? '如需重新生成，描述新的需求' : '描述你的需求'}</h4>
                <textarea
                  className="req-input"
                  rows={3}
                  value={params.request}
                  onChange={(e) => setRequest(e.target.value)}
                  placeholder="例如：帮我规划一份云南五日游，预算 3000 元，尽量不走回头路。"
                />
                {recognized.length > 0 && (
                  <p className="recognized">
                    已从描述中识别：{recognized.map((r) => <span key={r}>{r}</span>)}
                  </p>
                )}
                {parsed.warnings.map((w) => (
                  <p key={w} className="warn-text">
                    {w}
                  </p>
                ))}
              </section>

              <section className="block params">
                <div className="param">
                  <label>旅行天数</label>
                  <Stepper value={params.days} min={MIN_DAYS} max={MAX_DAYS} step={1} unit="天" onChange={(days) => setParams({ ...params, days })} />
                </div>
                <div className="param">
                  <label>
                    人均预算<small>不含往返大交通</small>
                  </label>
                  <Stepper value={params.budget} min={1500} max={6000} step={500} unit="元" onChange={(budget) => setParams({ ...params, budget })} />
                </div>
                <div className="param">
                  <label>出发日期</label>
                  <input
                    type="date"
                    className="date-input"
                    value={params.startDate}
                    onChange={(e) => e.target.value && setParams({ ...params, startDate: e.target.value })}
                  />
                </div>
                <div className="param">
                  <label>出行人数</label>
                  <Stepper value={params.people} min={1} max={6} step={1} unit="人" onChange={(people) => setParams({ ...params, people })} />
                </div>
                <div className="param param-col">
                  <label>偏好</label>
                  <div className="pref-row">
                    {PREF_OPTIONS.map((p) => {
                      const on = params.prefs.includes(p);
                      return (
                        <button
                          key={p}
                          className={`chip${on ? ' chip-on' : ''}`}
                          onClick={() => setParams({ ...params, prefs: on ? params.prefs.filter((x) => x !== p) : [...params.prefs, p] })}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            </>
          )}
        </>
      )}

      {confirming && plan && existing && (
        <div className="confirm-mask" onClick={() => setConfirming(false)}>
          <div className="confirm-box" role="alertdialog" onClick={(e) => e.stopPropagation()}>
            <h3>
              <TriangleAlert size={18} /> 重新生成会替换当前计划
            </h3>
            <ul className="confirm-list">
              <li>
                <b>日程</b>
                当前 v{plan.version}（{plan.days} 天，{startStr(plan)} 出发）将替换为新的「{planName(params.days)}」：{startStr(params)} 出发，人均 ¥
                {params.budget}，{params.people} 人
              </li>
              <li>
                <b>手动确认</b>
                {existing.manual > 0 ? `你手动确认的 ${existing.manual} 项安排不会带入新计划，需要重新确认` : '当前没有手动确认的安排'}
              </li>
              <li>
                <b>待办进度</b>
                已完成 {existing.todoDone}/{existing.todoTotal} 项，新计划会按新日程生成新的待办清单
              </li>
              <li>
                <b>变更记录</b>
                {existing.changes > 0 ? `${existing.changes} 条变更记录随原计划一并清除，不会出现在新计划中` : '当前没有变更记录'}
              </li>
              <li className="keep">
                <b>收藏夹</b>
                {collection.items.length} 篇收藏（含 {existing.comments} 条评论补充）全部保留；未用于新计划的评论补充会重新标记为「待检查」
              </li>
            </ul>
            <p className="muted tiny">演示版不保留历史计划，确认后原计划无法恢复。</p>
            <div className="foot-row">
              <button className="btn btn-ghost" onClick={() => setConfirming(false)}>
                取消，保留原计划
              </button>
              <button
                className="btn btn-primary btn-grow"
                onClick={() => {
                  setConfirming(false);
                  setStage(0);
                }}
              >
                确认重新生成
              </button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
