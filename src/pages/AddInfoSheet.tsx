import { useState } from 'react';
import { BookmarkCheck, BookmarkPlus, Heart } from 'lucide-react';
import { Sheet } from '../components/ui';
import { INFO_PRESETS } from '../data/collection';
import { nowStamp, useStore } from '../store';

export function AddInfoSheet() {
  const { state, dispatch } = useStore();
  const notes = state.collection.items.filter((i) => i.type !== 'comment');
  const [text, setText] = useState('');
  const [noteId, setNoteId] = useState('n-fish');
  const close = () => dispatch({ type: 'overlay', overlay: null });

  return (
    <Sheet title="收藏笔记的评论区" onClose={close} full>
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
    </Sheet>
  );
}
