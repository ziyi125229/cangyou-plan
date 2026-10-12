import { useState } from 'react';
import { ArrowRight, CalendarDays, CircleAlert, Heart, Lock, MessageCircle, RotateCcw, Sparkles } from 'lucide-react';
import { Cover, MockNote, TopBar } from '../components/ui';
import { INFO_PRESETS } from '../data/collection';
import { planStats } from '../logic/planner';
import { useStore } from '../store';
import type { Category } from '../types';

const FILTERS: ('全部' | Category)[] = ['全部', '攻略', '住宿', '美食', '拍照机位', '避坑', '交通', '评论补充'];

export function CollectionPage() {
  const { state, dispatch } = useStore();
  const { collection, plan } = state;
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('全部');
  const items = filter === '全部' ? collection.items : collection.items.filter((i) => i.category === filter);
  const unchecked = plan ? collection.items.filter((i) => i.impact === 'unchecked') : [];
  const stats = plan ? planStats(plan) : null;
  const feed = INFO_PRESETS.filter((p) => !collection.items.some((i) => i.id === `c-${p.id}`));

  const reset = () => {
    if (window.confirm('重置演示？收藏、计划和变更记录将恢复到初始状态。')) dispatch({ type: 'reset' });
  };

  return (
    <div className="page">
      <TopBar
        title="收藏夹"
        onBack={() => dispatch({ type: 'toast', text: '演示中，收藏夹详情页即为首页', tone: 'info' })}
        right={
          <button className="icon-btn" onClick={reset} aria-label="重置演示" title="重置演示">
            <RotateCcw size={18} />
          </button>
        }
      />
      <div className="scroll">
        <section className="col-head">
          <div className="col-head-row">
            <div>
              <h1>{collection.name}</h1>
              <p className="muted">
                {collection.items.length} 篇收藏 · {plan ? `准备中的${plan.name.replace(/^我的/, '')}` : collection.desc}
              </p>
            </div>
            <span className="tag-lock">
              <Lock size={11} /> 仅自己可见
            </span>
          </div>

          {plan && stats ? (
            <button className="plan-status" onClick={() => dispatch({ type: 'nav', view: { name: 'plan' } })}>
              <CalendarDays size={18} className="brand" />
              <div>
                <strong>已有一份{plan.name.replace('我的云南', '')}计划</strong>
                <small>
                  v{plan.version} · 已确认 {stats.confirmed} 项 · 待确认 {stats.pending} 项
                  {stats.risk ? ` · 风险 ${stats.risk} 项` : ''}
                </small>
              </div>
              <ArrowRight size={16} />
            </button>
          ) : (
            <div className="plan-status plan-status-empty">
              <CalendarDays size={18} />
              <div>
                <strong>还没有旅行计划</strong>
                <small>可以让 AI 基于这 {collection.items.length} 篇收藏生成</small>
              </div>
            </div>
          )}

          {feed.length > 0 && (
            <button className="comment-feed" onClick={() => dispatch({ type: 'overlay', overlay: { kind: 'addInfo' } })}>
              <MessageCircle size={16} />
              <div>
                <strong>
                  收藏笔记的评论区有 {feed.length} 条新评论{plan ? '，可能与你的计划有关' : ''}
                </strong>
                <small>
                  “{feed[0].text.slice(0, 20)}…” — 《{collection.items.find((i) => i.id === feed[0].fromNoteId)?.title.slice(0, 10)}…》
                </small>
              </div>
              <em>查看</em>
            </button>
          )}

          {unchecked.length > 0 && (
            <button
              className="alert-banner"
              onClick={() => dispatch({ type: 'nav', view: { name: 'impact', itemId: unchecked[0].id } })}
            >
              <CircleAlert size={16} />
              <span>
                新收藏的 {unchecked.length} 条信息<b>可能影响已有计划，待核实</b>
              </span>
              <em>检查影响</em>
            </button>
          )}
        </section>

        <div className="filter-row">
          {FILTERS.map((f) => (
            <button key={f} className={`chip${filter === f ? ' chip-on' : ''}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>

        {items.length === 0 ? (
          <p className="empty">这个分类下还没有收藏</p>
        ) : (
          <div className="masonry">
            {items.map((item) => (
              <article
                key={item.id}
                className={`note-card${item.isNew ? ' note-card-new' : ''}`}
                onClick={() => dispatch({ type: 'overlay', overlay: { kind: 'item', id: item.id } })}
              >
                <Cover item={item} />
                <div className="note-body">
                  <div className="note-tags">
                    <span className={`cat cat-${item.type}`}>{item.category}</span>
                    {item.isNew && <span className="cat cat-new">新收藏</span>}
                    {item.inPlan && <span className="cat cat-plan">已用于计划</span>}
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                  {item.impact === 'unchecked' && <p className="note-flag">可能影响已有计划，待核实</p>}
                  <div className="note-meta">
                    <span>{item.author}</span>
                    <span>
                      <Heart size={11} /> {item.likes}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        <MockNote kinds={['content']} />
      </div>

      <div className="bottom-bar">
        {plan && (
          <button className="btn btn-ghost" onClick={() => dispatch({ type: 'nav', view: { name: 'plan' } })}>
            查看计划
          </button>
        )}
        <button className="btn btn-primary btn-grow" onClick={() => dispatch({ type: 'overlay', overlay: { kind: 'ai' } })}>
          <Sparkles size={18} />
          <span>
            问问 AI
            <small>基于「{collection.name}」{collection.items.length} 篇收藏</small>
          </span>
        </button>
      </div>
    </div>
  );
}
