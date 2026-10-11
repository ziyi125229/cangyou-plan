import { Check, RotateCcw } from 'lucide-react';
import { useStore } from '../store';

export function DemoGuide() {
  const { state, dispatch } = useStore();
  const { plan, collection, progress } = state;
  const commentAdded = collection.items.some((i) => i.savedAt === '刚刚');
  const applied = !!plan?.changes.length;
  const steps = [
    { label: '打开「云南旅行」收藏夹，浏览收藏内容', done: true },
    { label: '点底部「问问 AI」，查看 AI 对收藏的理解', done: progress.aiOpened },
    { label: '设置参数，生成云南五日游计划', done: !!plan },
    { label: '从收藏笔记的评论区，加入「这家店在装修」评论', done: commentAdded },
    { label: '点「检查对行程的影响」，看评论钉在哪一天的哪项安排', done: progress.analyzed },
    { label: '选择调整方式，在同页预览更新后的行程并确认', done: applied },
    { label: '查看变更记录，尝试撤销', done: progress.changelogViewed && progress.undone },
  ];
  const next = steps.findIndex((s) => !s.done);

  return (
    <aside className="guide">
      <div className="guide-brand">
        <span className="logo">藏</span>
        <div>
          <h1>藏有计划</h1>
          <p>让收藏变成行动</p>
        </div>
      </div>
      <p className="guide-intro">
        小红书站内 AI 助手的场景化能力升级概念 Demo：以收藏夹作为任务上下文，生成可执行计划；当收藏笔记的评论区出现新情况（如店铺装修、景点关闭）时，定位受影响的行程并在你确认后更新。
      </p>
      <h2>演示路径</h2>
      <ol className="guide-steps">
        {steps.map((s, i) => (
          <li key={s.label} className={s.done ? 'done' : i === next ? 'next' : ''}>
            <span>{s.done ? <Check size={12} /> : i + 1}</span>
            {s.label}
          </li>
        ))}
      </ol>
      <button
        className="btn btn-outline btn-sm"
        onClick={() => window.confirm('重置演示？收藏、计划和变更记录将恢复到初始状态。') && dispatch({ type: 'reset' })}
      >
        <RotateCcw size={13} /> 重置演示
      </button>
      <p className="guide-foot">纯前端模拟：内容、价格、地点状态与分析结果均为演示数据，未接入小红书真实数据或任何模型。</p>
    </aside>
  );
}
