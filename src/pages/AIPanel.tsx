import { useEffect, useMemo, useState } from 'react';
import { Check, FolderHeart, LoaderCircle, Minus, Plus, ShieldAlert, Sparkles } from 'lucide-react';
import { MockNote, Sheet } from '../components/ui';
import {
  DEFAULT_PARAMS,
  MAX_DAYS,
  MIN_DAYS,
  PREF_OPTIONS,
  parseRequest,
  understandCollection,
  type Insight,
  type PlanParams,
} from '../logic/planner';
import { nowStamp, useStore } from '../store';

const STAGES = ['正在整理收藏内容', '正在关联景点与路线', '正在生成旅行计划'];

type Quick = 'full' | 'budget' | 'pitfall';
const QUICK: { id: Quick; label: string; desc: string }[] = [
  { id: 'full', label: '综合旅行攻略', desc: '路线 + 住宿 + 美食' },
  { id: 'budget', label: '整理路线与预算', desc: '按天拆分花费' },
  { id: 'pitfall', label: '检查收藏中的避坑信息', desc: '不生成计划' },
];

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

function InsightGroup({ title, list, tone }: { title: string; list: Insight[]; tone?: 'warn' }) {
  if (!list.length) return null;
  return (
    <div className="insight">
      <h5>
        {title} <span className="muted">{list.length}</span>
      </h5>
      <div className="insight-chips">
        {list.map((i) => (
          <span key={i.label} className={`ichip${tone ? ' ichip-warn' : ''}`}>
            {i.label}
            {i.sourceIds.length > 1 && <em>×{i.sourceIds.length}</em>}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AIPanel() {
  const { state, dispatch } = useStore();
  const { collection, plan } = state;
  const u = useMemo(() => understandCollection(collection.items), [collection.items]);
  const [params, setParams] = useState<PlanParams>(plan ? { days: plan.days, budget: plan.budget, people: plan.people, startDate: plan.startDate, prefs: plan.prefs, request: plan.request } : DEFAULT_PARAMS);
  const [quick, setQuick] = useState<Quick>('full');
  const [stage, setStage] = useState(-1);
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

  return (
    <Sheet
      full
      title="你想用这些收藏完成什么？"
      onClose={close}
      footer={
        generating ? null : quick === 'pitfall' ? (
          <button className="btn btn-primary btn-block" onClick={() => pickQuick('full')}>
            继续生成完整计划
          </button>
        ) : (
          <div className="foot-row">
            {plan && (
              <button className="btn btn-ghost" onClick={() => dispatch({ type: 'nav', view: { name: 'plan' } })}>
                查看当前计划
              </button>
            )}
            <button className="btn btn-primary btn-grow" onClick={() => setStage(0)}>
              <Sparkles size={16} /> {plan ? '重新生成计划' : '生成我的计划'}
            </button>
          </div>
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
          <MockNote>演示流程：使用确定性的模拟结果，不调用真实模型</MockNote>
        </div>
      ) : (
        <>
          <section className="block">
            <h4 className="block-title">AI 对这些收藏的初步理解</h4>
            <div className="insights">
              <InsightGroup title="已识别的景点" list={u.spots} />
              <InsightGroup title="住宿" list={u.stays} />
              <InsightGroup title="美食" list={u.foods} />
              <InsightGroup title="路线与游玩建议" list={u.routes} />
              <InsightGroup title="风险及待确认" list={u.risks} tone="warn" />
            </div>
            <MockNote />
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
                      <small>
                        来源：
                        {r.sourceIds.map((id) => collection.items.find((i) => i.id === id)?.title.slice(0, 16)).join('、')}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="muted tiny">共 {u.risks.length} 条，生成计划时会写入对应日期的注意事项。</p>
            </section>
          ) : (
            <>
              <section className="block">
                <h4 className="block-title">描述你的需求</h4>
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
              {plan && <p className="warn-text">已有一份计划（v{plan.version}）。重新生成会覆盖当前计划和变更记录。</p>}
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
