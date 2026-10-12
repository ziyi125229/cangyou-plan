import { DemoGuide } from './components/DemoGuide';
import { ToastView } from './components/ui';
import { AddInfoSheet } from './pages/AddInfoSheet';
import { AIPanel } from './pages/AIPanel';
import { ChangeLogPage } from './pages/ChangeLogPage';
import { CollectionPage } from './pages/CollectionPage';
import { GuidePage } from './pages/GuidePage';
import { ImpactPage } from './pages/ImpactPage';
import { ItemSheet } from './pages/ItemSheet';
import { PlanPage } from './pages/PlanPage';
import { StoreProvider, useStore } from './store';

function Screen() {
  const { state } = useStore();
  const { view, plan } = state;
  const needsPlan = view.name === 'plan' || view.name === 'guide' || view.name === 'changelog';
  if (needsPlan && !plan) return <CollectionPage />;
  switch (view.name) {
    case 'plan':
      return <PlanPage key={`plan-${plan?.version}-${view.day ?? 1}`} initialDay={view.day} />;
    case 'guide':
      return <GuidePage />;
    case 'impact':
      return <ImpactPage key={view.itemId} itemId={view.itemId} />;
    case 'changelog':
      return <ChangeLogPage />;
    default:
      return <CollectionPage />;
  }
}

function Overlays() {
  const { overlay, peek } = useStore().state;
  return (
    <>
      {overlay?.kind === 'ai' && <AIPanel />}
      {overlay?.kind === 'addInfo' && <AddInfoSheet />}
      {overlay?.kind === 'item' && <ItemSheet key={overlay.id} id={overlay.id} />}
      {peek && <ItemSheet key={`peek-${peek}`} id={peek} peek />}
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <div className="stage-wrap">
        <DemoGuide />
        <div className="phone">
          <Screen />
          <Overlays />
          <ToastView />
        </div>
      </div>
    </StoreProvider>
  );
}
