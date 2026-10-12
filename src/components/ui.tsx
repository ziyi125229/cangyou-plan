import { useEffect, type ReactNode } from 'react';
import {
  BedDouble,
  Bookmark,
  Camera,
  ChevronLeft,
  FileText,
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
import { commentOrigin } from '../logic/source';
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

export type Motif = 'lake' | 'town' | 'food' | 'rail' | 'sunset' | 'snow';

const mix = (hex: string, to: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [p(hex), p(to)];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
};

export function motifOf(text: string): Motif {
  if (/美食|酸辣鱼|粑粑|餐/.test(text)) return 'food';
  if (/动车|→|交通/.test(text)) return 'rail';
  if (/日落|狮子山/.test(text)) return 'sunset';
  if (/雪山/.test(text)) return 'snow';
  if (/洱海|苍山|束河|索道|机位/.test(text)) return 'lake';
  return 'town';
}

/** 示意插画（非真实照片）：按主题绘制的轻量风景 */
export function Scene({ motif, tone, className }: { motif: Motif; tone: string; className?: string }) {
  const sky = mix(tone, '#ffffff', 0.62);
  const far = mix(tone, '#ffffff', 0.32);
  const near = mix(tone, '#1f2329', 0.12);
  const glow = mix(tone, '#fff4d6', 0.75);
  return (
    <svg className={`scene ${className ?? ''}`} viewBox="0 0 300 220" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="300" height="220" fill={sky} />
      <circle cx={motif === 'sunset' ? 150 : motif === 'town' ? 78 : 228} cy={motif === 'sunset' ? 128 : 58} r={motif === 'sunset' ? 40 : 20} fill={glow} />
      {motif === 'snow' ? (
        <path d="M0 150 L70 70 L100 100 L150 30 L205 105 L235 80 L300 140 V220 H0Z" fill={far} />
      ) : (
        <path d="M0 140 Q50 88 100 118 T200 100 T300 112 V220 H0Z" fill={far} />
      )}
      {motif === 'snow' && <path d="M130 52 L150 30 L170 56 L158 50 L150 60 L141 50Z" fill="#fff" opacity="0.9" />}
      {motif === 'lake' && (
        <>
          <path d="M0 150 H300 V220 H0Z" fill={mix(tone, '#ffffff', 0.45)} />
          <path d="M30 168 H110 M150 182 H260 M60 196 H180" stroke="#fff" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {(motif === 'town' || motif === 'sunset') && (
        <g fill={near}>
          <path d="M0 220 V160 L30 142 L60 160 V220Z" />
          <path d="M50 220 V150 L95 124 L140 150 V220Z" />
          <path d="M130 220 V166 L165 146 L200 166 V220Z" />
          <path d="M190 220 V140 L240 112 L290 140 V220Z" />
          <rect x="226" y="60" width="12" height="80" rx="2" opacity={motif === 'town' ? 0.85 : 0} />
        </g>
      )}
      {motif === 'rail' && (
        <>
          <path d="M0 170 Q150 140 300 165 V220 H0Z" fill={near} />
          <path d="M-10 196 Q150 160 310 186" stroke="#fff" strokeOpacity="0.8" strokeWidth="4" fill="none" />
          <rect x="90" y="150" width="120" height="26" rx="12" fill="#fff" transform="rotate(-5 150 163)" />
          <g fill={far} transform="rotate(-5 150 163)">
            {[104, 128, 152, 176].map((x) => (
              <rect key={x} x={x} y="155" width="16" height="9" rx="2" />
            ))}
          </g>
        </>
      )}
      {motif === 'food' && (
        <>
          <path d="M0 160 H300 V220 H0Z" fill={near} />
          <ellipse cx="150" cy="158" rx="88" ry="18" fill="#fff" />
          <path d="M66 156 Q150 236 234 156Z" fill="#fff" />
          <ellipse cx="150" cy="158" rx="76" ry="12" fill={mix(tone, '#ffffff', 0.15)} />
          <path d="M120 128 q8 -14 0 -28 M150 124 q8 -14 0 -28 M180 128 q8 -14 0 -28" stroke="#fff" strokeOpacity="0.8" strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      )}
      {motif === 'snow' && <path d="M0 175 Q150 150 300 178 V220 H0Z" fill={near} />}
    </svg>
  );
}

export function Cover({ item }: { item: CollectionItem }) {
  const Icon = CATEGORY_ICON[item.category];
  if (item.type === 'comment') {
    return (
      <div className="cover cover-comment">
        <span className="cover-comment-tag">
          <MessageCircle size={12} /> 评论区
        </span>
        <p>“{item.body[0].replace(/[「」]/g, '')}”</p>
      </div>
    );
  }
  return (
    <div className={`cover${item.cover.tall ? ' cover-tall' : ''}`}>
      <Scene motif={motifOf(`${item.cover.label}${item.title}`)} tone={item.cover.tone} />
      <span className="cover-cat">
        <Icon size={11} strokeWidth={2.2} />
        {item.category}
      </span>
      <span className="cover-label">{item.cover.label}</span>
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
  peek,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  full?: boolean;
  peek?: boolean;
}) {
  return (
    <div className={`sheet-mask${peek ? ' sheet-peek' : ''}`} onClick={onClose}>
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

/** 信息来源链路：收藏夹 → 收藏的笔记 / 未收藏的原帖 → 评论区 */
export function SourceChain({ item, compact, onOpen }: { item: CollectionItem; compact?: boolean; onOpen?: (id: string) => void }) {
  const { state, dispatch } = useStore();
  const origin = commentOrigin(item, state.collection.items);
  const note = origin.kind === 'collected_note' ? origin.note : undefined;
  const post = origin.kind === 'external_post' ? origin.post : undefined;
  return (
    <ol className={`chain${compact ? ' chain-compact' : ''}`}>
      <li>
        <FolderHeart size={13} />
        <span>
          收藏夹<b>「{state.collection.name}」</b>
          {post && !compact && <small>单独收藏了这条评论</small>}
        </span>
      </li>
      {post && (
        <li className="chain-post">
          <FileText size={13} />
          <span>
            原帖<b>《{post.title}》</b>
            {!compact && <small>{post.author ? `${post.author} · ` : ''}该帖未收藏，仅保存了这条评论</small>}
          </span>
        </li>
      )}
      {note && (
        <li>
          <Bookmark size={13} />
          <button onClick={() => (onOpen ? onOpen(note.id) : dispatch({ type: 'overlay', overlay: { kind: 'item', id: note.id } }))}>
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

export type MockKind = 'content' | 'rule' | 'unverified';

/** 统一的模拟能力边界说明 */
export const MOCK_LABEL: Record<MockKind, { tag: string; text: string }> = {
  content: { tag: '演示内容', text: '收藏笔记、评论与价格均为虚构，不来自小红书真实数据' },
  rule: { tag: '规则分析', text: '基于预设关键词与结构化字段生成，未调用大模型' },
  unverified: { tag: '待核实', text: '营业、开放、预约等真实状态未经核实，以官方信息为准' },
};

export function MockNote({ kinds = ['rule'] }: { kinds?: MockKind[] }) {
  return (
    <div className="mock-note mock-note-list">
      <FlaskConical size={12} />
      <div>
        {kinds.map((k) => (
          <p key={k}>
            <b>{MOCK_LABEL[k].tag}</b>
            {MOCK_LABEL[k].text}
          </p>
        ))}
      </div>
    </div>
  );
}