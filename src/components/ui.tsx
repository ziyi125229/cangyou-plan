import { useEffect, type ReactNode } from 'react';
import {
  BedDouble,
  Bookmark,
  Camera,
  ChevronLeft,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  FlaskConical,
  FolderHeart,
  MapPin,
  MessageCircle,
  ShieldAlert,
  Train,
  Utensils,
  X,
} from 'lucide-react';
import { useStore } from '../store';
import type { ActKind, ActStatus, Category, CollectionItem } from '../types';

export function StatusBadge({ status, small }: { status: ActStatus; small?: boolean }) {
  const map = {
    confirmed: { label: '已确认', Icon: CircleCheck },
    pending: { label: '待确认', Icon: CircleHelp },
    risk: { label: '有风险', Icon: CircleAlert },
  } as const;
  const { label, Icon } = map[status];
  return (
    <span className={`badge badge-${status}${small ? ' badge-sm' : ''}`}>
      <Icon size={small ? 11 : 12} strokeWidth={2.4} />
      {label}
    </span>
  );
}

export const CATEGORY_ICON: Record<Category, typeof MapPin> = {
  攻略: MapPin,
  住宿: BedDouble,
  美食: Utensils,
  拍照机位: Camera,
  避坑: ShieldAlert,
  交通: Train,
  评论补充: MessageCircle,
};

export const KIND_ICON: Record<ActKind, typeof MapPin> = {
  transport: Train,
  stay: BedDouble,
  spot: MapPin,
  food: Utensils,
  photo: Camera,
};

export function Cover({ item }: { item: CollectionItem }) {
  const Icon = CATEGORY_ICON[item.category];
  if (item.type === 'comment') {
    return (
      <div className="cover cover-comment">
        <MessageCircle size={16} />
        <p>“{item.body[0].replace(/[「」]/g, '')}”</p>
      </div>
    );
  }
  return (
    <div className={`cover${item.cover.tall ? ' cover-tall' : ''}`} style={{ background: item.cover.tone }}>
      <Icon size={22} strokeWidth={1.8} />
      <span>{item.cover.label}</span>
    </div>
  );
}

export function TopBar({
  title,
  sub,
  onBack,
  right,
}: {
  title: ReactNode;
  sub?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <header className="topbar">
      {onBack ? (
        <button className="icon-btn" onClick={onBack} aria-label="返回">
          <ChevronLeft size={22} />
        </button>
      ) : (
        <span className="icon-btn-placeholder" />
      )}
      <div className="topbar-title">
        <strong>{title}</strong>
        {sub && <small>{sub}</small>}
      </div>
      <div className="topbar-right">{right ?? <span className="icon-btn-placeholder" />}</div>
    </header>
  );
}

export function Sheet({
  title,
  onClose,
  children,
  footer,
  full,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  full?: boolean;
}) {
  return (
    <div className="sheet-mask" onClick={onClose}>
      <div className={`sheet${full ? ' sheet-full' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="sheet-head">
          <span className="sheet-grip" />
          <div className="sheet-title">{title}</div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ToastView() {
  const { state, dispatch } = useStore();
  const t = state.toast;
  useEffect(() => {
    if (!t) return;
    const timer = setTimeout(() => dispatch({ type: 'clearToast', id: t.id }), 2400);
    return () => clearTimeout(timer);
  }, [t, dispatch]);
  if (!t) return null;
  return (
    <div className={`toast toast-${t.tone ?? 'success'}`} key={t.id} role="status">
      {t.text}
    </div>
  );
}

export function SourceChips({ ids }: { ids: string[] }) {
  const { state, dispatch } = useStore();
  const items = ids.map((id) => state.collection.items.find((i) => i.id === id)).filter(Boolean) as CollectionItem[];
  if (!items.length) return <span className="muted tiny">收藏中无直接来源</span>;
  return (
    <div className="source-chips">
      {items.map((i) => (
        <button key={i.id} className="source-chip" onClick={() => dispatch({ type: 'overlay', overlay: { kind: 'item', id: i.id } })}>
          {i.type === 'comment' ? <MessageCircle size={11} /> : <Bookmark size={11} />}
          {i.title.replace(/^评论补充：/, '').slice(0, 12)}
          {i.title.replace(/^评论补充：/, '').length > 12 ? '…' : ''}
        </button>
      ))}
    </div>
  );
}

/** 信息来源链路：收藏夹 → 收藏的笔记 → 评论区 */
export function SourceChain({ item, compact }: { item: CollectionItem; compact?: boolean }) {
  const { state, dispatch } = useStore();
  const note = state.collection.items.find((i) => i.id === item.fromNoteId);
  return (
    <ol className={`chain${compact ? ' chain-compact' : ''}`}>
      <li>
        <FolderHeart size={13} />
        <span>
          收藏夹<b>「{state.collection.name}」</b>
        </span>
      </li>
      {note && (
        <li>
          <Bookmark size={13} />
          <button onClick={() => dispatch({ type: 'overlay', overlay: { kind: 'item', id: note.id } })}>
            收藏的笔记<b>《{note.title}》</b>
            {!compact && <small>收藏于 {note.savedAt} · 点击查看原笔记</small>}
          </button>
        </li>
      )}
      <li className="chain-comment">
        <MessageCircle size={13} />
        <span>
          评论区 · {item.author.replace('评论 · ', '')}
          {!compact && (
            <small>
              {item.timeInfo} · {item.likes} 赞
            </small>
          )}
        </span>
      </li>
    </ol>
  );
}

export function MockNote({ children }: { children?: ReactNode }) {
  return (
    <div className="mock-note">
      <FlaskConical size={12} />
      {children ?? '模拟分析结果 · 基于预设规则与演示数据，未调用真实模型'}
    </div>
  );
}
