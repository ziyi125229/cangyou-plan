export type ItemType = 'note' | 'comment' | 'pitfall';
export type Category = '攻略' | '住宿' | '美食' | '拍照机位' | '避坑' | '交通' | '评论补充';

/** 新增收藏对已有计划的处理状态 */
export type ImpactState = 'none' | 'unchecked' | 'dismissed' | 'applied';

export interface Entities {
  spots?: string[];
  stays?: string[];
  foods?: string[];
  routes?: string[];
  risks?: string[];
}

export interface NoteComment {
  id: string;
  author: string;
  text: string;
  likes: number;
  time: string;
  /** 可被收藏为「评论补充」的预置评论 */
  presetId?: string;
}

export interface CollectionItem {
  id: string;
  title: string;
  type: ItemType;
  category: Category;
  summary: string;
  body: string[];
  author: string;
  likes: string;
  places: string[];
  timeInfo: string;
  inPlan: boolean;
  entities: Entities;
  cover: { tone: string; label: string; tall?: boolean };
  comments?: NoteComment[];
  /** 笔记主要讲的对象，用于解析评论里的「这家店」等指代 */
  subject?: string;
  /** 评论补充：来源笔记 */
  fromNoteId?: string;
  impact: ImpactState;
  isNew?: boolean;
  savedAt: string;
}

export interface Collection {
  id: string;
  name: string;
  desc: string;
  items: CollectionItem[];
  planId: string | null;
}

export type ActStatus = 'confirmed' | 'pending' | 'risk';
export type ActKind = 'transport' | 'stay' | 'spot' | 'food' | 'photo';

export interface Activity {
  id: string;
  time: string;
  title: string;
  place: string;
  kind: ActKind;
  detail: string;
  status: ActStatus;
  statusNote?: string;
  tip?: string;
  cost: number;
  sourceIds: string[];
  aliases?: { strong: string[]; weak?: string[] };
  changed?: boolean;
  changeNote?: string;
  /** 引发本次变更的评论 */
  changeSource?: { itemId: string; text: string };
}

export interface DayPlan {
  id: string;
  day: number;
  title: string;
  area: string;
  summary: string;
  activities: Activity[];
  changeTag?: string;
}

export interface Todo {
  id: string;
  text: string;
  done: boolean;
  day?: number;
  fromChange?: string;
}

export type OptionId = 'mark_pending' | 'replace' | 'keep' | 'add_note';

export interface PlanSnapshot {
  dayPlans: DayPlan[];
  todos: Todo[];
  version: number;
}

export interface ChangeRecord {
  id: string;
  at: string;
  title: string;
  reason: string;
  sourceItemId: string;
  sourceText: string;
  option: OptionId;
  optionLabel: string;
  day: number;
  before: Activity[];
  after: Activity[];
  addedTodos: string[];
  budgetDelta: number;
  snapshot: PlanSnapshot;
  undone: boolean;
  undoneAt?: string;
}

export interface Plan {
  id: string;
  name: string;
  days: number;
  budget: number;
  people: number;
  startDate: string;
  prefs: string[];
  request: string;
  notes: string[];
  dayPlans: DayPlan[];
  todos: Todo[];
  changes: ChangeRecord[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type View =
  | { name: 'collection' }
  | { name: 'plan'; day?: number }
  | { name: 'guide' }
  | { name: 'impact'; itemId: string }
  | { name: 'changelog' };

export type Overlay =
  | { kind: 'ai' }
  | { kind: 'item'; id: string }
  | { kind: 'addInfo' }
  | null;

export interface Draft {
  itemId: string;
  analyzed: boolean;
  option: OptionId | null;
  altId: string | null;
  activityId: string | null;
}
