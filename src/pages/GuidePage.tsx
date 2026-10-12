import { MockNote, StatusBadge, TopBar } from '../components/ui';
import { budgetBreakdown, dayCost, dayDate, fmtDate, understandCollection } from '../logic/planner';
import { useStore } from '../store';

export function GuidePage() {
  const { state, dispatch } = useStore();
  const { plan, collection } = state;
  if (!plan) return null;
  const u = understandCollection(collection.items);
  const budget = budgetBreakdown(plan);
  const acts = plan.dayPlans.flatMap((d) => d.activities.map((a) => ({ d, a })));
  const stays = acts.filter(({ a }) => a.kind === 'stay');
  const foods = acts.filter(({ a }) => a.kind === 'food');
  const pending = acts.filter(({ a }) => a.status !== 'confirmed');

  return (
    <div className="page">
      <TopBar title="完整攻略" sub={`${plan.name} · v${plan.version}`} onBack={() => dispatch({ type: 'nav', view: { name: 'plan' } })} />
      <div className="scroll doc">
        <h1>{plan.name}</h1>
        <p className="muted">
          {fmtDate(dayDate(plan, 1))} – {fmtDate(dayDate(plan, plan.days))} · {plan.days} 天 · {plan.people} 人 · 人均预算 ¥{plan.budget} · 参考收藏夹「{collection.name}」{collection.items.length} 篇
        </p>
        <MockNote kinds={['content', 'rule']} />

        <h2>一、行程安排</h2>
        {plan.dayPlans.map((d) => (
          <div key={d.id} className="doc-day">
            <h3>
              <span>
                Day {d.day} · {fmtDate(dayDate(plan, d.day))} · {d.title}
              </span>
              <small>人均 ¥{dayCost(d)}</small>
            </h3>
            <ul>
              {d.activities.map((a) => (
                <li key={a.id}>
                  <span className="doc-time">{a.time}</span>
                  <span>
                    {a.title}
                    {a.changed && <em className="doc-changed">已变更</em>}
                  </span>
                  <StatusBadge status={a.status} small />
                </li>
              ))}
            </ul>
          </div>
        ))}

        <h2>二、预算</h2>
        <table className="doc-table">
          <tbody>
            {budget.lines.map((l) => (
              <tr key={l.label}>
                <td>{l.label}</td>
                <td>¥{l.amount}</td>
              </tr>
            ))}
            <tr>
              <td>机动</td>
              <td>¥{budget.reserve}</td>
            </tr>
            <tr className="doc-total">
              <td>人均合计</td>
              <td>¥{plan.budget}</td>
            </tr>
          </tbody>
        </table>

        <h2>三、住宿建议</h2>
        <ul className="doc-list">
          {stays.map(({ d, a }) => (
            <li key={a.id}>
              Day {d.day}：{a.title}（人均 ¥{a.cost}）{a.detail && ` — ${a.detail}`}
            </li>
          ))}
        </ul>

        <h2>四、美食建议</h2>
        <ul className="doc-list">
          {foods.map(({ d, a }) => (
            <li key={a.id}>
              Day {d.day}：{a.title.replace('午餐：', '').replace('晚餐：', '')}
              {a.detail && ` — ${a.detail}`}
            </li>
          ))}
        </ul>

        <h2>五、避坑事项</h2>
        <ul className="doc-list">
          {u.risks.map((r) => (
            <li key={r.label}>{r.label}</li>
          ))}
        </ul>

        <h2>六、待确认信息</h2>
        {pending.length === 0 ? (
          <p className="muted">暂无</p>
        ) : (
          <ul className="doc-list">
            {pending.map(({ d, a }) => (
              <li key={a.id}>
                Day {d.day} · {a.title}：{a.statusNote}
              </li>
            ))}
          </ul>
        )}
        {plan.changes.filter((c) => !c.undone).length > 0 && (
          <>
            <h2>七、更新记录</h2>
            <ul className="doc-list">
              {plan.changes
                .filter((c) => !c.undone)
                .map((c) => (
                  <li key={c.id}>
                    {c.at} · {c.title}
                  </li>
                ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
