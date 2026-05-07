export { useAutomationRulePreview } from './hooks/useAutomationRulePreview';
export { useAutomationRealStats } from './hooks/useAutomationRealStats';
export type { AutomationRealStats } from './hooks/useAutomationRealStats';
export { AutomationPreviewPanel } from './components/AutomationPreviewPanel';
export { AutomationRunHistory } from './components/AutomationRunHistory';
export { fetchAutomationRulePreview } from './api/automationPreviewApi';
export { listRunsForRule, rollbackRun } from './api/automationRunsApi';
export type { AutomationRunSummary } from './api/automationRunsApi';
export { computeSpecificityScore } from './lib/ruleScoring';
export type {
  AutomationPreview,
  AutomationPreviewExample,
  PreviewConditionInput,
  PreviewRequestInput,
} from './api/automationPreviewApi';
