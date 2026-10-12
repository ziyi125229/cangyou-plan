import { Bookmark, BookmarkCheck, CircleAlert, Clock, Heart, MapPin } from 'lucide-react';
import { Cover, Sheet, SourceChain } from '../components/ui';
import { useStore, nowStamp } from '../store';

export function ItemSheet({ id, peek }: { id: string; peek?: boolean }) {
  const { state, dispatch } = useStore();
  const item = state.collection.items.find((i) => i.id === id);
  if (!item) return null;
  const close = () => dispatch(peek ? { type: 'peek', id: null } : { type: 'overlay', overlay: null });
  const open = (target: string) => dispatch(peek ? { type: 'peek', id: target } : { type: 'overlay', overlay: { kind: 'item', id: target } });
  const collected = (presetId: string) => state.collection.items.some((i) => i.id === `c-${presetId}`);

  return (
    <Sheet title={item.type === 'comment' ? '评论补充' : '笔记预览'} onClose={close} full peek={peek}>
      <div className="item-detail">
        {item.type !== 'comment' && <Cover item={item} />}
        <h2>{item.title}</h2>
        <div className="item-meta">
          <span>{item.author}</span>
          <span>
            <Heart size={12} /> {item.likes}
          </span>
          <span>收藏于 {item.savedAt}</span>
        </div>
        {item.type === 'comment' ? (
          <blockquote className="quote">{item.body[0]}</blockquote>
        ) : (
          item.body.map((p, i) => <p key={i}>{p}</p>)
        )}
        {item.type === 'comment' && <SourceChain item={item} onOpen={open} />}
        <div className="kv">
          {item.places.length > 0 && (
            <span>
              <MapPin size={12} /> {item.places.join(' / ')}
            </span>
          )}
          {item.timeInfo !== '—' && (
            <span>
              <Clock size={12} /> {item.timeInfo}
            </span>
          )}
        </div>
        <div className="item-state">
          {item.inPlan ? <span className="cat cat-plan">已用于当前计划</span> : <span className="cat">未用于计划</span>}
          {state.plan && (item.impact === 'unchecked' || item.impact === 'dismissed') && (
            <button className="btn btn-sm btn-warn" onClick={() => dispatch({ type: 'nav', view: { name: 'impact', itemId: item.id } })}>
              <CircleAlert size={14} /> {item.impact === 'dismissed' ? '重新检查影响' : '检查对行程的影响'}
            </button>
          )}
        </div>

        {item.comments && (
          <section className="comments">
            <h4>评论区 {item.comments.length}</h4>
            {item.comments.map((c) => (
              <div key={c.id} className="comment">
                <div className="comment-head">
                  <b>{c.author}</b>
                  <span className="muted tiny">{c.time}</span>
                </div>
                <p>{c.text}</p>
                <div className="comment-foot">
                  <span className="muted tiny">
                    <Heart size={11} /> {c.likes}
                  </span>
                  {c.presetId &&
                    (collected(c.presetId) ? (
                      <span className="collected">
                        <BookmarkCheck size={13} /> 已在「{state.collection.name}」
                      </span>
                    ) : (
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => dispatch({ type: 'collect', presetId: c.presetId, at: nowStamp(), goImpact: true })}
                      >
                        <Bookmark size={13} /> 加入「{state.collection.name}」
                      </button>
                    ))}
                </div>
              </div>
            ))}
            <p className="muted tiny">评论内容为演示用虚构数据</p>
          </section>
        )}
      </div>
    </Sheet>
  );
}
