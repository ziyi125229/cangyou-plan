import { useState } from 'react';
import { Bookmark, CalendarDays, ChevronRight, CircleAlert, CircleCheck, Heart, Lock, MessageCircle, RotateCcw, Sparkles } from 'lucide-react';
import { Cover, MockNote, Scene, TopBar } from '../components/ui';
import { INFO_PRESETS } from '../data/collection';
import { dayDate, fmtDate, planStats } from '../logic/planner';
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
            <button className="plan-entry" onClick={() => dispatch({ type: 'nav', view: { name: 'plan' } })}>
              <span className="plan-entry-thumb">
                <Scene motif="lake" tone="#3b7dd8" />
                <CalendarDays size={16} />
              </span>
              <div>
                <strong>{plan.name}</strong>
                <small>
                  {fmtDate(dayDate(plan, 1))} 出发 · {plan.days} 天 · v{plan.version}
                  {stats.pending + stats.risk > 0 ? ` · ${stats.pending + stats.risk} 项待确认` : ' · 已全部确认'}
                </small>
              </div>
              <span className="plan-entry-go">
                查看 <ChevronRight size={14} />
              </span>
            </button>
          ) : (
            <button className="plan-entry plan-entry-empty" onClick={() => dispatch({ type: 'overlay', overlay: { kind: 'ai' } })}>
              <span className="plan-entry-thumb">
                <Sparkles size={16} />
              </span>
              <div>
                <strong>还没有旅行计划</strong>
                <small>让 AI 把这 {collection.items.length} 篇收藏整理成可执行的行程</small>
              </div>
              <ChevronRight size={16} className="muted" />
            </button>
          )}

          {feed.length > 0 && (
            <button className="comment-feed" onClick={() => dispatch({ type: 'overlay', overlay: { kind: 'addInfo' } })}>
              <span className="comment-avatar">
                <MessageCircle size={14} />
              </span>
              <div>
                <strong>
                  你收藏的笔记下有 {feed.length} 条新评论{plan ? '，可能和行程有关' : ''}
                </strong>
                <small>“{feed[0].text.slice(0, 22)}…”</small>
                <small className="comment-feed-from">
                  来自《{collection.items.find((i) => i.id === feed[0].fromNoteId)?.title.slice(0, 14)}…》
                </small>
              </div>
              <em>去看看</em>
            </button>
          )}

          <button className="ext-entry" onClick={() => dispatch({ type: 'overlay', overlay: { kind: 'addInfo', tab: 'external' } })}>
            <Bookmark size={13} />
            <span>
              刷到<b>其他帖子里的有用评论</b>？可以单独收藏
            </span>
            <em>
              去收藏 <ChevronRight size={13} />
            </em>
          </button>

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
                  {item.isNew && (
                    <div className="note-tags">
                      <span className="cat cat-new">新收藏</span>
                    </div>
                  )}
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                  {item.impact === 'unchecked' && <p className="note-flag">可能影响已有计划，待核实</p>}
                  <div className="note-meta">
                    <span>
                      {item.inPlan && <CircleCheck size={11} className="in-plan" aria-label="已用于计划" />}
                      {item.author}
                    </span>
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
