import type { CollectionItem, SourcePost } from '../types';

export type CommentOrigin =
  | { kind: 'collected_note'; note: CollectionItem }
  | { kind: 'external_post'; post: SourcePost }
  | { kind: 'unknown' };

/** 评论补充的来源；旧数据没有 commentSource 时按 fromNoteId 推断 */
export function commentOrigin(item: CollectionItem, items: CollectionItem[]): CommentOrigin {
  if (item.commentSource === 'external_post' && item.sourcePost) return { kind: 'external_post', post: item.sourcePost };
  const note = item.fromNoteId ? items.find((i) => i.id === item.fromNoteId) : undefined;
  return note ? { kind: 'collected_note', note } : { kind: 'unknown' };
}

/** 只有来自已收藏笔记的评论才有可靠的上下文，可用于解析「这家店」等指代 */
export function contextNote(item: CollectionItem, items: CollectionItem[]): CollectionItem | undefined {
  const o = commentOrigin(item, items);
  return o.kind === 'collected_note' ? o.note : undefined;
}

/** 用于修改原因等文案，如「收藏笔记「…」的评论区」 */
export function originLabel(o: CommentOrigin): string | undefined {
  if (o.kind === 'collected_note') return `收藏笔记「${o.note.title}」的评论区`;
  if (o.kind === 'external_post') return `帖子「${o.post.title}」下单独收藏的评论`;
  return undefined;
}
