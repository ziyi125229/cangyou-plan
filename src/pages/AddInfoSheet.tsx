import { useState } from 'react';
import { ArrowRight, BookmarkCheck, BookmarkPlus, CircleAlert, Heart } from 'lucide-react';
import { Scene, Sheet, motifOf } from '../components/ui';
import { EXTERNAL_PRESETS, INFO_PRESETS } from '../data/collection';
import { nowStamp, useStore } from '../store';

type Tab = 'notes' | 'external';

function ExternalList() {
  const { state, dispatch } = useStore();
  const { collection, plan } = state;
  return (
    <>
      <p className="muted sheet-intro">
        模拟刷小红书时，在<b>没有收藏的帖子</b>下看到有用的评论，一键收藏到「{collection.name}」。不需要收藏整篇帖子，也不用填写任何来源。（帖子与评论为演示用虚构内容）
      </p>
      <div className="preset-list">
        {EXTERNAL_PRESETS.map((p) => {
          const saved = collection.items.find((i) => i.id === `c-${p.id}`);
          return (
            <div key={p.id} className="preset ext-preset">
              <div className="preset-note ext-post">
                <span className="preset-thumb ext-thumb">
                  {p.post.cover && <Scene motif={motifOf(p.post.cover.label)} tone={p.post.cover.tone} />}
                </span>
                <span>
                  <small>帖子 · 未收藏{p.post.author ? ` · ${p.post.author}` : ''}</small>
                  {p.post.title}
                </span>
              </div>
              <div className="preset-comment">
                <div className="comment-head">
                  <b>{p.author}</b>
                  <span className="muted tiny">
                    {p.time} · <Heart size={10} /> {p.likes}
                  </span>
                </div>
                <p>{p.text}</p>
              </div>
              <div className="preset-foot">
                <span className="preset-hint">{p.hint}</span>
                {saved ? (
                  <span className="collected">
                    <BookmarkCheck size={13} /> 已收藏
                  </span>
                ) : (
                  <button className="btn btn-sm btn-primary" onClick={() => dispatch({ type: 'collectExternal', presetId: p.id, at: nowStamp() })}>
                    <BookmarkPlus size={13} /> 收藏到{collection.name}
                  </button>
                )}
              </div>
              {saved &&
                (plan && saved.impact === 'unchecked' ? (
                  <button className="ext-next" onClick={() => dispatch({ type: 'nav', view: { name: 'impact', itemId: saved.id } })}>
                    <CircleAlert size={14} />
                    <span>这条新信息可能影响你的计划</span>
                    <em>
                      检查影响 <ArrowRight size={12} />
                    </em>
                  </button>
                ) : (
                  <p className="ext-done">
                    {plan
                      ? saved.impact === 'applied'
                        ? '已据此更新计划'
                        : '已检查，保留在收藏夹中'
                      : '已加入收藏夹，生成计划时会一起参考'}
                  </p>
                ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

function NoteCommentList() {
  const { state, dispatch } = useStore();
  const notes = state.collection.items.filter((i) => i.type !== 'comment');
  const [text, setText] = useState('');
  const [noteId, setNoteId] = useState('n-fish');
  return (
    <>
      <p className="muted sheet-intro">
        以下是「{state.collection.name}」里已收藏笔记评论区的新评论。评论区常有正文里没有的最新情况，加入收藏夹后，AI 会检查它们对计划的影响。（评论为演示用虚构内容）
      </p>
      <div className="preset-list">
        {INFO_PRESETS.map((p) => {
          const from = state.collection.items.find((i) => i.id === p.fromNoteId);
          const done = state.collection.items.some((i) => i.id === `c-${p.id}`);
          return (
            <div key={p.id} className="preset">
              {from && (
                <button className="preset-note" onClick={() => dispatch({ type: 'overlay', overlay: { kind: 'item', id: from.id } })}>
                  <span className="preset-thumb" style={{ background: from.cover.tone }} />
                  <span>
                    <small>收藏的笔记</small>
                    {from.title}
                  </span>
                </button>
              )}
              <div className="preset-comment">
                <div className="comment-head">
                  <b>{p.author}</b>
                  <span className="muted tiny">
                    {p.time} · <Heart size={10} /> {p.likes}
                  </span>
                </div>
                <p>{p.text}</p>
              </div>
              <div className="preset-foot">
                <span className="preset-hint">{p.hint}</span>
                {done ? (
                  <span className="collected">
                    <BookmarkCheck size={13} /> 已加入
                  </span>
                ) : (
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => dispatch({ type: 'collect', presetId: p.id, at: nowStamp(), goImpact: true })}
                  >
                    <BookmarkPlus size={13} /> 加入「{state.collection.name}」
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="block">
        <h4 className="block-title">模拟一条新评论</h4>
        <label className="field-label">出现在哪篇收藏笔记的评论区</label>
        <select className="select" value={noteId} onChange={(e) => setNoteId(e.target.value)}>
          {notes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </select>
        <textarea
          className="req-input"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例如：这家店下周起暂停营业装修，12月初才开"
        />
        <button
          className="btn btn-outline btn-block"
          disabled={!text.trim()}
          onClick={() => dispatch({ type: 'collect', text, fromNoteId: noteId, at: nowStamp(), goImpact: true })}
        >
          加入收藏夹并检查
        </button>
        <p className="muted tiny">按预设规则模拟分析：识别「装修」「关闭」「进不去」等风险词、「这家店」等指代（结合所在笔记）以及「X 月底」等时间。</p>
      </div>
    </>
  );
}

export function AddInfoSheet() {
  const { state, dispatch } = useStore();
  const initial = state.overlay?.kind === 'addInfo' ? state.overlay.tab ?? 'notes' : 'notes';
  const [tab, setTab] = useState<Tab>(initial);
  const close = () => dispatch({ type: 'overlay', overlay: null });

  return (
    <Sheet title="收藏新的评论信息" onClose={close} full>
      <div className="seg" role="tablist">
        <button role="tab" className={tab === 'notes' ? 'on' : ''} onClick={() => setTab('notes')}>
          收藏笔记的新评论
        </button>
        <button role="tab" className={tab === 'external' ? 'on' : ''} onClick={() => setTab('external')}>
          刷到的其他帖子评论
        </button>
      </div>
      {tab === 'notes' ? <NoteCommentList /> : <ExternalList />}
    </Sheet>
  );
}
