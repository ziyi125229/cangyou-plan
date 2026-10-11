import { History, ListPlus, Undo2 } from 'lucide-react';
import { FieldDiffList } from '../components/diff';
import { SourceChain, TopBar } from '../components/ui';
import { nowStamp, useStore } from '../store';

export function ChangeLogPage() {
  const { state, dispatch } = useStore();
  const { plan, collection } = state;
  if (!plan) return null;
  const latestActive = plan.changes.find((c) => !c.undone);

  return (
    <div className="page">
      <TopBar title="变更记录" sub={`${plan.name} · 当前 v${plan.version}`} onBack={() => dispatch({ type: 'nav', view: { name: 'plan' } })} />
      <div className="scroll">
        {plan.changes.length === 0 ? (
          <div className="empty">
            <History size={28} />
            <p>还没有变更。从收藏笔记的评论区加入新评论并确认更新后，修改原因和前后差异会记录在这里。</p>
          </div>
        ) : (
          <ol className="log">
            {plan.changes.map((c) => {
              const src = collection.items.find((i) => i.id === c.sourceItemId);
              return (
                <li key={c.id} className={`log-item${c.undone ? ' undone' : ''}`}>
                  <div className="log-head">
                    <b>{c.title}</b>
                    {c.undone ? <span className="badge badge-sm badge-muted">已撤销</span> : <span className="badge badge-sm badge-changed">生效中</span>}
                  </div>
                  <p className="muted tiny">
                    {c.at} · 处理方式：{c.optionLabel}
                    {c.undoneAt && ` · 撤销于 ${c.undoneAt}`}
                  </p>
                  <p className="log-reason">
                    <span>修改原因</span>
                    {c.reason}
                  </p>
                  {src && <SourceChain item={src} compact />}
                  <div className="log-diff">
                    <span className="diff-label diff-label-after">Day {c.day} 修改内容</span>
                    {c.after.map((a) => {
                      const b = c.before.find((x) => x.id === a.id);
                      return (
                        <div key={a.id} className="log-act">
                          <b>
                            {a.time} {a.title}
                          </b>
                          {b && <FieldDiffList before={b} after={a} />}
                        </div>
                      );
                    })}
                    {(c.addedTodos ?? []).map((t) => (
                      <p key={t} className="log-todo">
                        <ListPlus size={12} /> 新增待办：{t}
                      </p>
                    ))}
                  </div>
                  <p className="muted tiny">
                    预算：{c.budgetDelta === 0 ? '不变' : `人均 ${c.budgetDelta > 0 ? '+' : '−'}¥${Math.abs(c.budgetDelta)}`} · 其他日期安排未改动
                  </p>
                  {latestActive?.id === c.id && (
                    <button className="btn btn-sm btn-outline" onClick={() => dispatch({ type: 'undo', at: nowStamp() })}>
                      <Undo2 size={13} /> 撤销这次更新
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
