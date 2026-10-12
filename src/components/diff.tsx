import { MessageCircle } from 'lucide-react';
import { diffActivity } from '../logic/impact';
import type { Activity, DayPlan } from '../types';
import { KIND_ICON, StatusBadge } from './ui';

export function FieldDiffList({ before, after }: { before: Activity; after: Activity }) {
  const diffs = diffActivity(before, after);
  if (!diffs.length) return null;
  return (
    <ul className="fdiff">
      {diffs.map((d) => (
        <li key={d.label}>
          <span className="fdiff-label">{d.label}</span>
          <span className="fdiff-val">
            {d.from && <s>{d.from}</s>}
            {d.from && <i>→</i>}
            <b>{d.to}</b>
          </span>
        </li>
      ))}
    </ul>
  );
}

type Mark = 'hit' | 'maybe' | 'info';
const MARK_LABEL: Record<Mark, string> = { hit: '受影响', maybe: '可能受影响', info: '相关' };

/** 当天行程 + 把评论「钉」在受影响的那一项上 */
export function DayPinView({
  day,
  dateLabel,
  focusId,
  adjacentIds,
  mark,
  comment,
  sourceLabel,
}: {
  day: DayPlan;
  dateLabel: string;
  focusId: string;
  adjacentIds: string[];
  mark: Mark;
  comment: string;
  sourceLabel?: string;
}) {
  return (
    <div className="pin-day">
      <div className="pin-day-head">
        Day {day.day} · {dateLabel} · {day.title}
      </div>
      {day.activities.map((a) => {
        const Icon = KIND_ICON[a.kind];
        const focus = a.id === focusId;
        return (
          <div key={a.id}>
            <div className={`pin-row${focus ? ` pin-focus pin-${mark}` : ''}${adjacentIds.includes(a.id) ? ' pin-adj' : ''}`}>
              <span className="mini-time">{a.time}</span>
              <Icon size={13} />
              <span className="mini-title">{a.title}</span>
              {focus ? (
                <span className={`pin-tag pin-tag-${mark}`}>{MARK_LABEL[mark]}</span>
              ) : adjacentIds.includes(a.id) ? (
                <span className="pin-tag">相邻</span>
              ) : (
                <StatusBadge status={a.status} small />
              )}
            </div>
            {focus && (
              <div className={`pin-bubble pin-bubble-${mark}`}>
                <MessageCircle size={12} />
                <div>
                  <p>{comment}</p>
                  {sourceLabel && <small>{sourceLabel}</small>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 更新预览：当天行程中变化的项逐字段展示 */
export function DayPreview({ before, after, dateLabel }: { before: DayPlan; after: DayPlan; dateLabel: string }) {
  const prev = new Map(before.activities.map((a) => [a.id, a]));
  return (
    <div className="pin-day">
      <div className="pin-day-head">
        Day {after.day} · {dateLabel} · 更新后
      </div>
      {after.activities.map((a) => {
        const b = prev.get(a.id);
        const changed = b && diffActivity(b, a).length > 0;
        const Icon = KIND_ICON[a.kind];
        return (
          <div key={a.id} className={changed ? 'pv-changed' : 'pv-same'}>
            <div className="pin-row">
              <span className="mini-time">{a.time}</span>
              <Icon size={13} />
              <span className="mini-title">{a.title}</span>
              {changed ? <span className="pin-tag pin-tag-chg">将变更</span> : <span className="pv-keep">不变</span>}
            </div>
            {changed && b && <FieldDiffList before={b} after={a} />}
          </div>
        );
      })}
    </div>
  );
}
