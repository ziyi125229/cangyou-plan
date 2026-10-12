import { useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  FileText,
  History,
  Lightbulb,
  MapPin,
  MessageCircle,
  MessageSquarePlus,
  Square,
  SquareCheck,
  Undo2,
} from 'lucide-react';
import { KIND_ICON, MockNote, Scene, SourceChips, StatusBadge, TopBar, type Motif } from '../components/ui';
import { budgetBreakdown, dayCost, dayDate, fmtDate, planStats } from '../logic/planner';
import { nowStamp, useStore } from '../store';
import type { Activity, DayPlan } from '../types';

const PERIODS = [
  { label: '上午', test: (t: string) => t < '12:00' },
  { label: '下午', test: (t: string) => t >= '12:00' && t < '18:00' },
  { label: '晚上', test: (t: string) => t >= '18:00' },
];

const DAY_SCENE: Record<string, { motif: Motif; tone: string }> = {
  'day-arrive': { motif: 'town', tone: '#b0805a' },
  'day-erhai': { motif: 'lake', tone: '#3b7dd8' },
  'day-cangshan': { motif: 'lake', tone: '#5b6fa8' },
  'day-lijiang': { motif: 'sunset', tone: '#c0607e' },
  'day-snow': { motif: 'snow', tone: '#5f8fc4' },
  'day-return': { motif: 'lake', tone: '#6b8f4e' },
};

const cityOf = (d: DayPlan) =>
  d.activities.some((a) => a.id.startsWith('lijiang-stay')) || d.activities.some((a) => a.id === 'return-back') ? '丽江' : '大理';

function ActivityRow({ a, open }: { a: Activity; open: boolean }) {
  const { dispatch } = useStore();
  const Icon = KIND_ICON[a.kind];
  return (
    <li className={`act act-${a.status}${a.changed ? ' act-changed' : ''}`}>
      <span className="act-time">{a.time}</span>
      <span className={`act-dot kind-${a.kind}`}>
        <Icon size={13} />
      </span>
      <div className="act-main">
        <div className="act-title">
          <b>{a.title}</b>
        </div>
        <div className="act-sub">
          <span>
            {a.place}
            {a.cost > 0 && ` · 人均 ¥${a.cost}`}
          </span>
          {a.changed && <span className="badge badge-changed badge-sm">已变更</span>}
          <StatusBadge status={a.status} small />
        </div>
        {a.changeNote && <p className="act-change">{a.changeNote}</p>}
        {a.changeSource && (
          <button className="act-cause" onClick={() => dispatch({ type: 'overlay', overlay: { kind: 'item', id: a.changeSource!.itemId } })}>
            <MessageCircle size={11} />
            <span>因评论调整：{a.changeSource.text}</span>
          </button>
        )}
        {a.statusNote && <p className={`act-note act-note-${a.status}`}>{a.statusNote}</p>}
        {a.tip && !a.changeSource && <p className="act-tip">评论提醒：{a.tip}</p>}
        {open && (
          <div className="act-more">
            {a.detail && <p>{a.detail}</p>}
            <SourceChips ids={a.sourceIds} />
            {a.status !== 'confirmed' && (
              <button className="btn btn-sm btn-outline" onClick={() => dispatch({ type: 'confirmActivity', id: a.id })}>
                <CircleCheck size={13} /> 我已核实，标记为已确认
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function PlanPage({ initialDay }: { initialDay?: number }) {
  const { state, dispatch } = useStore();
  const { plan, collection } = state;
  const [day, setDay] = useState(initialDay ?? 1);
  const [open, setOpen] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const todoRef = useRef<HTMLElement>(null);
  const followRef = useRef<HTMLElement>(null);
  if (!plan) return null;

  const stats = planStats(plan);
  const budget = budgetBreakdown(plan);
  const current = plan.dayPlans.find((d) => d.day === day) ?? plan.dayPlans[0];
  const unchecked = collection.items.filter((i) => i.impact === 'unchecked');
  const lastChange = plan.changes.find((c) => !c.undone);
  const followUps = plan.dayPlans.flatMap((d) => d.activities.filter((a) => a.status !== 'confirmed').map((a) => ({ d, a })));
  const nights = (city: string) => plan.dayPlans.filter((d) => d.activities.some((a) => a.id.startsWith(`${city}-stay`))).length;
  const todoDone = plan.todos.filter((t) => t.done).length;
  const scene = DAY_SCENE[current.id] ?? { motif: 'town' as const, tone: '#8c6a4f' };

  const checkNew = () =>
    unchecked.length
      ? dispatch({ type: 'nav', view: { name: 'impact', itemId: unchecked[0].id } })
      : dispatch({ type: 'overlay', overlay: { kind: 'addInfo' } });

  return (
    <div className="page">
      <TopBar
        title={plan.name}
        sub={`来自收藏夹「${collection.name}」`}
        onBack={() => dispatch({ type: 'nav', view: { name: 'collection' } })}
        right={
          <button className="icon-btn badge-host" onClick={() => dispatch({ type: 'nav', view: { name: 'changelog' } })} aria-label="变更记录">
            <History size={19} />
            {plan.changes.length > 0 && <i className="dot-count">{plan.changes.length}</i>}
          </button>
        }
      />
      <div className="scroll">
        <section className="plan-head">
          <div className="plan-route">
            <b>
              {fmtDate(dayDate(plan, 1))} – {fmtDate(dayDate(plan, plan.days))}
            </b>
            <span>
              {plan.days} 天 {plan.days - 1} 晚 · {plan.people} 人
            </span>
            <span className={`ver ver-${plan.version > 1 ? 'up' : 'gen'}`}>
              {plan.version > 1 ? `已更新 · v${plan.version}` : '已生成 · v1'}
            </span>
          </div>
          <p className="plan-cities">
            <MapPin size={13} /> 大理 {nights('dali')} 晚 <ArrowRight size={12} /> 丽江 {nights('lijiang')} 晚 · 单向不走回头路
          </p>
          <p className="muted tiny">
            生成于 {plan.createdAt}
            {plan.updatedAt !== plan.createdAt && ` · 最近更新 ${plan.updatedAt}`}
          </p>
        </section>

        {lastChange && plan.version > 1 && (
          <div className="success-banner">
            <CircleCheck size={16} />
            <div>
              <b>计划已更新</b>
              <span>{lastChange.title}</span>
            </div>
            <button onClick={() => dispatch({ type: 'nav', view: { name: 'changelog' } })}>查看差异</button>
            <button onClick={() => dispatch({ type: 'undo', at: nowStamp() })}>
              <Undo2 size={13} /> 撤销
            </button>
          </div>
        )}

        {unchecked.length > 0 && (
          <button className="alert-banner" onClick={checkNew}>
            <MessageCircle size={16} />
            <span>
              收藏夹新增 {unchecked.length} 条评论信息<b>可能影响已有计划，待核实</b>
            </span>
            <em>检查影响</em>
          </button>
        )}

        <section className="card summary">
          <div className="sum-row">
            <button className="sum-cell" onClick={() => setShowBudget(!showBudget)}>
              <span>人均预算</span>
              <b>¥{plan.budget}</b>
              <small className={budget.reserve < 0 ? 'neg' : ''}>
                {budget.reserve >= 0 ? `机动 ¥${budget.reserve}` : `超出 ¥${-budget.reserve}`}
                {showBudget ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </small>
            </button>
            <button className="sum-cell" onClick={() => todoRef.current?.scrollIntoView({ behavior: 'smooth' })}>
              <span>待办</span>
              <b>
                {todoDone}
                <i>/{plan.todos.length}</i>
              </b>
              <small>出发前完成</small>
            </button>
            <button className="sum-cell" onClick={() => followRef.current?.scrollIntoView({ behavior: 'smooth' })}>
              <span>待确认</span>
              <b className={stats.pending + stats.risk ? 'pend' : ''}>{stats.pending + stats.risk}</b>
              <small>已确认 {stats.confirmed} 项</small>
            </button>
          </div>
          <div className="bar">
            {budget.lines.map((l, i) => (
              <span key={l.label} className={`bar-seg seg-${i}`} style={{ width: `${(l.amount / Math.max(plan.budget, budget.used)) * 100}%` }} />
            ))}
          </div>
          {showBudget && (
            <div className="bar-legend">
              {budget.lines.map((l, i) => (
                <span key={l.label}>
                  <i className={`seg-${i}`} />
                  {l.label} ¥{l.amount}
                </span>
              ))}
              <span>已安排 ¥{budget.used}</span>
            </div>
          )}
          <p className="muted tiny">按人均估算，不含往返大交通；价格为演示数据。</p>
        </section>

        <div className="day-tabs" role="tablist">
          {plan.dayPlans.map((d) => (
            <button key={d.id} role="tab" className={`day-tab${d.day === current.day ? ' on' : ''}`} onClick={() => setDay(d.day)}>
              Day {d.day}
              <small>
                {fmtDate(dayDate(plan, d.day))} · {cityOf(d)}
              </small>
              {d.changeTag && <i className="tab-dot" />}
            </button>
          ))}
        </div>

        <section className={`card day-card${current.changeTag ? ' day-card-changed' : ''}`}>
          <div className="day-hero">
            <Scene motif={scene.motif} tone={scene.tone} />
            <div className="day-hero-text">
              <span>
                Day {current.day} · {fmtDate(dayDate(plan, current.day), true)} · {cityOf(current)}
              </span>
              <h3>{current.title}</h3>
            </div>
            {current.changeTag && <span className="badge badge-changed day-hero-tag">{current.changeTag}</span>}
          </div>
          <div className="day-head">
            <p>
              {current.area} · {current.summary}
            </p>
            <div className="day-cost">
              <small>当日人均</small>
              <b>¥{dayCost(current)}</b>
            </div>
          </div>
          <ul className="timeline">
            {PERIODS.map((p) => {
              const acts = current.activities.filter((a) => p.test(a.time));
              if (!acts.length) return null;
              return (
                <li key={p.label} className="period">
                  <span className="period-label">{p.label}</span>
                  <ul>
                    {acts.map((a) => (
                      <ActivityRow key={a.id} a={a} open={open} />
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
          <button className="expand-btn" onClick={() => setOpen(!open)}>
            {open ? (
              <>
                收起详细安排 <ChevronUp size={14} />
              </>
            ) : (
              <>
                展开详细安排与参考收藏 <ChevronDown size={14} />
              </>
            )}
          </button>
        </section>

        <section className="card" ref={todoRef}>
          <h4 className="block-title">
            出发前待办 <span className="muted">{todoDone}/{plan.todos.length}</span>
          </h4>
          <ul className="todos">
            {plan.todos.map((t) => (
              <li key={t.id}>
                <button className={`todo${t.done ? ' done' : ''}`} onClick={() => dispatch({ type: 'toggleTodo', id: t.id })}>
                  {t.done ? <SquareCheck size={18} /> : <Square size={18} />}
                  <span>{t.text}</span>
                  {t.day && <em>Day {t.day}</em>}
                  {t.fromChange && <em className="em-new">来自更新</em>}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card" ref={followRef}>
          <h4 className="block-title">
            待确认与风险 <span className="muted">{followUps.length}</span>
          </h4>
          {followUps.length === 0 ? (
            <p className="muted">暂无待确认事项</p>
          ) : (
            <ul className="follow">
              {followUps.map(({ d, a }) => (
                <li key={a.id}>
                  <button onClick={() => setDay(d.day)}>
                    <StatusBadge status={a.status} small />
                    <span>
                      Day {d.day} · {a.title}
                      <small>{a.statusNote}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h4 className="block-title">
            <Lightbulb size={14} /> 规划说明
          </h4>
          <ul className="notes">
            {plan.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <MockNote kinds={['content', 'rule', 'unverified']} />
        </section>
      </div>

      <div className="bottom-bar">
        <button className="btn btn-ghost" onClick={() => dispatch({ type: 'nav', view: { name: 'guide' } })}>
          <FileText size={16} /> 完整攻略
        </button>
        <button className="btn btn-primary btn-grow" onClick={checkNew}>
          <MessageSquarePlus size={16} /> {unchecked.length ? '检查对行程的影响' : '收藏笔记新评论 · 检查更新'}
        </button>
      </div>
    </div>
  );
}
