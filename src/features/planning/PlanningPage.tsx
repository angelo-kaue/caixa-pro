import { useState } from 'react';
import clsx from 'clsx';
import { BudgetsTab } from './BudgetsTab';
import { GoalsTab } from './GoalsTab';
import { RecurringTab } from './RecurringTab';

const tabs = [
  { id: 'budgets', label: 'Orçamentos' },
  { id: 'goals', label: 'Metas' },
  { id: 'recurring', label: 'Recorrências' },
] as const;

type TabId = (typeof tabs)[number]['id'];

export function PlanningPage() {
  const [tab, setTab] = useState<TabId>('budgets');
  return (
    <div className="space-y-6">
      <h1 className="page-title">Planejamento</h1>
      <div role="tablist" aria-label="Seções de planejamento" className="flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={clsx('-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors', tab === t.id ? 'border-brand text-fg' : 'border-transparent text-mute hover:text-fg')}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'budgets' && <BudgetsTab />}
        {tab === 'goals' && <GoalsTab />}
        {tab === 'recurring' && <RecurringTab />}
      </div>
    </div>
  );
}
