import { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  ListPlus,
  LoaderCircle,
  MessageCircle,
  Route,
  ShieldCheck,
  Sparkles,
  Star,
  Undo2,
  Wallet,
} from 'lucide-react';
import { DayPinView, DayPreview } from '../components/diff';
import { MockNote, SourceChain, TopBar } from '../components/ui';
import { ALTERNATIVES, REFINEMENTS, analyzeImpact, applyOption, optionLabel, riskSentence, type ImpactResult } from '../logic/impact';
import { dayDate, fmtDate } from '../logic/planner';
import { nowStamp, useStore } from '../store';
import type { OptionId } from '../types';

const STEPS = ['读取评论与来源笔记的上下文', '匹配计划中的地点与日期', '评估影响范围与可信度'];
const FLOW = ['加入评论', '检查影响', '选择调整', '确认更新'];

const OPTION_DESC: Record<OptionId, string> = {
  mark_pending: '先不换，状态改为待确认，并生成核实待办',
  replace: '优先从你的收藏里挑选替代，尽量不动相邻安排',
  keep: '安排不变，标记风险，出发前一天再核实',
  add_note: '把评论里的建议写进这项安排，并生成待办',
};

function optionsFor(r: ImpactResult): { id: OptionId; disabled?: boolean; recommended?: boolean }[] {
  if (r.kind === 'info') return r.activity ? [{ id: 'add_note', recommended: true }] : [];
  if (!r.activity) return [];
  const hasAlt = !!ALTERNATIVES[r.activity.id]?.length;
  const notAffectedByDate = r.timing?.within === false;
  return [
    { id: 'replace', disabled: !hasAlt, recommended: !notAffectedByDate && r.kind === 'matched' && hasAlt },
    { id: 'mark_pending', recommended: !notAffectedByDate && (r.kind === 'ambiguous' || !hasAlt) },
    { id: 'keep', recommended: notAffectedByDate },
  ];
}

function FlowSteps({ current }: { current: number }) {
  return (
    <ol className="flow">
      {FLOW.map((s, i) => (
        <li key={s} className={i < current ? 'done' : i === current ? 'on' : ''}>
          <span>{i < current ? <Check size={10} strokeWidth={3} /> : i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}

export function ImpactPage({ itemId }: { itemId: string }) {
  const { state, dispatch } = useStore();
  const { plan, collection, draft } = state;
  const item = collection.items.find((i) => i.id === itemId);
  const from = collection.items.find((i) => i.id === item?.fromNoteId);
  const text = item?.body[0] ?? '';
  const result = useMemo(() => analyzeImpact(text, plan, from), [text, plan, from]);
  const analyzed = draft?.itemId === itemId && draft.analyzed;
  const [step, setStep] = useState(-1);
  const [showBasis, setShowBasis] = useState(false);

  useEffect(() => {
    if (draft?.itemId !== itemId) dispatch({ type: 'draft', draft: { itemId, analyzed: false, option: null, altId: null, activityId: null } });
  }, [draft?.itemId, itemId, dispatch]);

  useEffect(() => {
    if (step < 0) return;
    if (step >= STEPS.length) {
      const opts = optionsFor(result);
      const rec = opts.find((o) => o.recommended)?.id ?? null;
      const alts = result.activity ? ALTERNATIVES[result.activity.id] : undefined;
      dispatch({
        type: 'draft',
        draft: { option: rec, activityId: result.activity?.id ?? null, altId: alts?.find((a) => a.recommended)?.id ?? alts?.[0]?.id ?? null },
      });
      dispatch({ type: 'analyzed' });
      setStep(-1);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 480);
    return () => clearTimeout(t);
  }, [step, result, dispatch]);

  const preview = useMemo(() => {
    if (!analyzed || !plan || !item || !draft?.option || !draft.activityId) return null;
    return applyOption({ plan, item, sourceTitle: from?.title, activityId: draft.activityId, option: draft.option, altId: draft.altId, at: 'preview' });
  }, [analyzed, plan, item, from, draft]);

  if (!item) {
    return (
      <div className="page">
        <TopBar title="评论影响检查" onBack={() => dispatch({ type: 'nav', view: { name: 'collection' } })} />
        <p className="empty">这条信息已不在收藏夹中</p>
      </div>
    );
  }

  const back = () => dispatch({ type: 'nav', view: plan ? { name: 'plan' } : { name: 'collection' } });
  const opts = optionsFor(result);
  const alts = result.activity ? ALTERNATIVES[result.activity.id] ?? [] : [];
  const analyzing = step >= 0;
  const actionable = analyzed && opts.length > 0;
  const t = result.timing;
  const isFood = result.activity?.kind === 'food';
  const dateOf = (d: number) => (plan ? fmtDate(dayDate(plan, d), true) : '');
  const dayLabel = result.day ? `Day ${result.day.day}（${dateOf(result.day.day)}）` : '';
  const activeChange = plan?.changes.find((c) => !c.undone);
  const flowStep = item.impact === 'applied' ? 4 : !analyzed ? 1 : 2;

  const conclusion = (() => {
    const a = result.activity;
    if (result.kind === 'none') return { tone: 'none', head: '与当前行程无关', sub: '没有在计划中找到相关的地点或安排，这条评论会保留在收藏夹中。' };
    if (result.kind === 'ambiguous' && !a)
      return { tone: 'none', head: '提到了风险，但定位不到具体安排', sub: `评论提到「${result.riskWords.join('」「')}」，但没说是哪里，计划暂不调整。` };
    if (!a || !result.day) return { tone: 'none', head: '', sub: '' };
    if (result.kind === 'info')
      return {
        tone: 'info',
        head: `可以帮你完善 ${dayLabel} 的安排`,
        sub: `评论没有提到关闭或装修，不构成风险；但它对「${a.title}」有参考价值，可以写进安排。`,
      };
    if (result.kind === 'ambiguous')
      return { tone: 'maybe', head: `可能影响 ${dayLabel}「${a.title}」`, sub: '评论没写明具体地点，只能推断可能相关，建议先标记待确认。' };
    if (t?.within === false)
      return {
        tone: 'clear',
        head: `${dayLabel} 大概率不受影响`,
        sub: `评论说 ${t.reopenLabel}恢复${isFood ? '营业' : '开放'}，你的行程在那之后，建议出发前再确认一次。`,
      };
    const subject = result.resolved?.subject ?? a.place;
    return {
      tone: 'hit',
      head: `这条评论会影响 ${dayLabel} 的${isFood ? a.title.split('：')[0] : `「${a.title}」`}`,
      sub: t?.within
        ? `「${subject}」${t.duration ? `装修约 ${t.duration}，` : ''}${t.reopenLabel}才恢复，你 ${dateOf(result.day.day).split(' ')[0]} 去会跑空。`
        : `评论提到「${subject}」正在装修，${riskSentence(a.kind)}。`,
    };
  })();

  const touched = new Set(preview?.record.before.map((a) => a.id));
  const kept = plan ? plan.dayPlans.flatMap((d) => d.activities).filter((a) => a.status === 'confirmed' && !touched.has(a.id)).length : 0;
  const selectedAlt = draft?.option === 'replace' ? alts.find((a) => a.id === draft.altId) : undefined;

  return (
    <div className="page">
      <TopBar title="评论对行程的影响" sub={`收藏夹「${collection.name}」`} onBack={back} />
      <FlowSteps current={flowStep} />
      <div className="scroll">
        <section className={`card info-card${analyzed ? ' info-card-compact' : ''}`}>
          <div className="info-src">
            <MessageCircle size={14} />
            <span>来自收藏笔记评论区的新评论</span>
          </div>
          <blockquote className="quote">{text}</blockquote>
          <SourceChain item={item} compact={analyzed} />
          {!analyzed && (
            <span className={`info-status info-status-${item.impact}`}>
              <CircleAlert size={13} />
              {item.impact === 'applied' ? '已处理，计划已更新' : item.impact === 'dismissed' ? '已查看，暂不修改' : '可能影响已有计划，待核实'}
            </span>
          )}
        </section>

        {!plan && (
          <section className="card">
            <p>当前还没有旅行计划，生成计划后可以检查这条评论的影响。</p>
            <button className="btn btn-primary btn-block" onClick={() => dispatch({ type: 'overlay', overlay: { kind: 'ai' } })}>
              <Sparkles size={16} /> 问问 AI 生成计划
            </button>
          </section>
        )}

        {plan && !analyzed && !analyzing && (
          <section className="card hint-card">
            <p>
              评论区常有笔记正文里没有的最新情况。AI 会结合这条评论所在的笔记，找出它对应你行程里的哪一天、哪一项，再给出调整建议。
              <b>确认之前不会修改计划。</b>
            </p>
          </section>
        )}

        {analyzing && (
          <section className="card stages">
            {STEPS.map((s, i) => (
              <div key={s} className={`stage${i < step ? ' done' : i === step ? ' doing' : ''}`}>
                {i < step ? <Check size={16} /> : i === step ? <LoaderCircle size={16} className="spin" /> : <span className="dot" />}
                {s}
              </div>
            ))}
          </section>
        )}

        {plan && analyzed && (
          <>
            <section className={`card verdict verdict-${conclusion.tone}`}>
              <span className="verdict-kicker">AI 判断（模拟）</span>
              <h3>{conclusion.head}</h3>
              <p>{conclusion.sub}</p>
              {result.activity && result.day && (
                <DayPinView
                  day={result.day}
                  dateLabel={dateOf(result.day.day)}
                  focusId={result.activity.id}
                  adjacentIds={result.kind === 'info' ? [] : result.adjacent.map((a) => a.id)}
                  mark={result.kind === 'info' ? 'info' : result.kind === 'ambiguous' || t?.within === false ? 'maybe' : 'hit'}
                  comment={text}
                  noteTitle={from?.title}
                />
              )}
              <button className="basis-toggle" onClick={() => setShowBasis(!showBasis)}>
                {showBasis ? '收起判断依据' : '查看判断依据'}
                {showBasis ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {showBasis && (
                <dl className="basis">
                  {result.resolved && from && (
                    <>
                      <dt>指代</dt>
                      <dd>
                        评论里的「{result.resolved.phrase}」→ 结合来源笔记《{from.title}》，指「{result.resolved.subject}」
                      </dd>
                    </>
                  )}
                  <dt>关键词</dt>
                  <dd className="kw-row">
                    {result.matchedWords.map((w) => (
                      <span key={w} className="kw kw-place">
                        地点 · {w}
                      </span>
                    ))}
                    {result.riskWords.map((w) => (
                      <span key={w} className="kw kw-risk">
                        风险 · {w}
                      </span>
                    ))}
                    {t?.reopenLabel && <span className="kw kw-time">时间 · {t.reopenLabel}</span>}
                    {!result.matchedWords.length && !result.riskWords.length && <span className="muted">未识别到</span>}
                  </dd>
                  {t && result.day && (
                    <>
                      <dt>时间</dt>
                      <dd>
                        <CalendarClock size={12} /> 评论：{t.duration ? `装修约 ${t.duration}` : ''}
                        {t.reopenLabel ? ` · ${t.reopenLabel}恢复` : ''}；你的行程：{dateOf(result.day.day)}
                      </dd>
                    </>
                  )}
                  {result.kind !== 'none' && (
                    <>
                      <dt>可信度</dt>
                      <dd>
                        <span className="badge badge-pending badge-sm">尚未核实</span> 1 条用户评论（{item.likes} 赞，{item.timeInfo}）
                        {text.includes('老板') ? '，转述店主说法' : ''}，无官方信息
                      </dd>
                    </>
                  )}
                  {result.activity && result.kind !== 'info' && (
                    <>
                      <dt>影响范围</dt>
                      <dd>仅 Day {result.day?.day} 这一项及相邻衔接；其他 {result.unaffectedConfirmed} 项已确认安排不受影响</dd>
                    </>
                  )}
                </dl>
              )}
            </section>

            {actionable && (
              <section className="card">
                <h4 className="block-title">怎么调整？</h4>
                <div className="options">
                  {opts.map((o) => (
                    <div key={o.id}>
                      <button
                        disabled={o.disabled}
                        className={`option${draft?.option === o.id ? ' on' : ''}`}
                        onClick={() => dispatch({ type: 'draft', draft: { option: o.id } })}
                      >
                        <span className="radio" />
                        <span>
                          <b>
                            {optionLabel(o.id, result.activity?.kind, result.activity?.id)}
                            {o.recommended && <em className="rec">推荐</em>}
                          </b>
                          <small>
                            {o.disabled
                              ? '该安排暂无预置替代'
                              : o.id === 'add_note' && result.activity && REFINEMENTS[result.activity.id]
                                ? REFINEMENTS[result.activity.id].desc
                                : OPTION_DESC[o.id]}
                          </small>
                        </span>
                      </button>
                      {o.id === 'replace' && draft?.option === 'replace' && (
                        <div className="alt-list">
                          {alts.map((alt) => {
                            const src = collection.items.find((i) => i.id === alt.fromItemId);
                            return (
                              <button
                                key={alt.id}
                                className={`alt${draft.altId === alt.id ? ' on' : ''}`}
                                onClick={() => dispatch({ type: 'draft', draft: { altId: alt.id } })}
                              >
                                <div className="alt-head">
                                  <span className="radio" />
                                  <b>{alt.title.replace(/^(午餐|晚餐)：/, '')}</b>
                                  {alt.recommended && (
                                    <em className="rec">
                                      <Star size={10} /> 推荐
                                    </em>
                                  )}
                                </div>
                                {src && (
                                  <span className="alt-src">
                                    <Bookmark size={11} /> 来自你的收藏《{src.title.slice(0, 14)}…》
                                  </span>
                                )}
                                <ul>
                                  {alt.reasons.slice(0, 2).map((r) => (
                                    <li key={r}>{r}</li>
                                  ))}
                                </ul>
                                <p className="alt-trade">取舍：{alt.tradeoff}</p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {preview && result.day && (
              <section className="card preview-card">
                <h4 className="block-title">
                  更新预览 <span className="muted tiny">确认后才会生效</span>
                </h4>
                <DayPreview
                  before={result.day}
                  after={preview.plan.dayPlans.find((d) => d.day === preview.record.day)!}
                  dateLabel={dateOf(preview.record.day)}
                />
                <div className="pv-effects">
                  <span>
                    <Wallet size={13} /> 预算
                    <b>
                      {preview.record.budgetDelta === 0
                        ? '不变'
                        : `人均 ${preview.record.budgetDelta > 0 ? '+' : '−'}¥${Math.abs(preview.record.budgetDelta)}`}
                    </b>
                  </span>
                  <span>
                    <Route size={13} /> 路线<b>{selectedAlt ? selectedAlt.routeImpact : '不变'}</b>
                  </span>
                  {preview.record.addedTodos.map((td) => (
                    <span key={td}>
                      <ListPlus size={13} /> 新增待办<b>{td}</b>
                    </span>
                  ))}
                  <span className="pv-kept">
                    <ShieldCheck size={13} /> 其他 {kept} 项已确认安排<b>保持不变</b>
                  </span>
                </div>
                {activeChange && (
                  <button className="link-btn" onClick={() => dispatch({ type: 'undo', at: nowStamp() })}>
                    <Undo2 size={13} /> 撤销最近一次更新（{activeChange.title}）
                  </button>
                )}
              </section>
            )}
            <MockNote />
          </>
        )}
      </div>

      {plan && (
        <div className="bottom-bar">
          {item.impact === 'applied' && !analyzed ? (
            <button className="btn btn-ghost btn-block" onClick={() => dispatch({ type: 'nav', view: { name: 'plan' } })}>
              已处理，查看计划
            </button>
          ) : !analyzed ? (
            <button className="btn btn-primary btn-block" disabled={analyzing} onClick={() => setStep(0)}>
              {analyzing ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
              {analyzing ? '分析中…' : '检查对行程的影响'}
            </button>
          ) : actionable ? (
            <>
              <button className="btn btn-ghost" onClick={() => dispatch({ type: 'dismiss', itemId })}>
                暂不修改
              </button>
              <button className="btn btn-primary btn-grow" disabled={!preview} onClick={() => dispatch({ type: 'apply', at: nowStamp() })}>
                <CircleCheck size={16} /> 确认更新 · v{plan.version} → v{plan.version + 1}
              </button>
            </>
          ) : (
            <button className="btn btn-primary btn-block" onClick={() => dispatch({ type: 'dismiss', itemId })}>
              知道了，保留在收藏夹
            </button>
          )}
        </div>
      )}
    </div>
  );
}
