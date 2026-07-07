/**
 * PR1 — Single source of truth for automation rule matching, scoring,
 * conflict resolution and persistence.
 *
 * Replaces the duplicated matchesRule logic that used to live in
 * `apply-automation-rule`, `apply-all-automation-rules`,
 * `automation-rule-preview` and the per-fetch path of `bridge-sync`.
 *
 * Public surface:
 *   - applyAutomationRulesForCompany(args): the orchestrator. Always enforces
 *     tenant security (companyId mandatory, ruleId/transactionIds checked).
 *   - previewRule(args): dry-run a candidate rule for a company.
 *
 * Decisions returned per transaction are explicit and exhaustive:
 *   'applied' | 'no_match' | 'already_categorized' | 'type_mismatch'
 *   | 'target_category_invalid' | 'conflict'
 *
 * The orchestrator is idempotent: a second call on the same company without
 * any new uncategorized transaction returns applied = 0.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { matchesAutomationCondition } from './automationRuleMatchingCore.ts';
import { computeSpecificityScore, isConflictingScore } from './ruleScoring.ts';
import {
  appendRunItems,
  createRun,
  finishRun,
  type RunItemInput,
  type TriggeredBy as LoggerTriggeredBy,
} from './automationRunLogger.ts';
import {
  computePreview,
  type PreviewCondition,
  type PreviewExistingRule,
  type PreviewResult,
  type PreviewTransaction,
} from './automationPreviewCore.ts';
import type { RuleCondition } from './repositories/AutomationRepository.ts';

export type EngineDecision =
  | 'applied'
  | 'no_match'
  | 'already_categorized'
  | 'type_mismatch'
  | 'target_category_invalid'
  | 'conflict';

export type EngineTriggeredBy = 'manual' | 'cron' | 'system' | 'bridge_sync';

export interface TransactionDecision {
  transaction_id: string;
  decision: EngineDecision;
  winning_rule_id: string | null;
  target_category_id: string | null;
  competing_rules?: string[];
  reason_codes: string[];
}

export interface ApplyArgs {
  client: SupabaseClient;
  companyId: string;
  userId: string | null;
  triggeredBy: EngineTriggeredBy;
  ruleId?: string;
  transactionIds?: string[];
  dryRun: boolean;
}

export interface ApplyResult {
  runId: string | null;
  matched: number;
  applied: number;
  skippedConflict: number;
  decisions: TransactionDecision[];
}

interface NormalizedRule {
  id: string;
  name: string;
  company_id: string;
  user_id: string;
  is_active: boolean;
  priority: number;
  specificity_score: number;
  created_at: string;
  target_category_id: string;
  target_category_type: string | null;
  conditions: RuleCondition[];
  match_count: number;
}

interface TransactionRow {
  id: string;
  description: string | null;
  amount: number | string | null;
  type: string | null;
  category_id: string | null;
  company_id: string | null;
  user_id: string | null;
  bank_account_name: string | null;
  merchant_key: string | null;
  normalized_description: string | null;
  deleted_at: string | null;
}

export class TenantSecurityError extends Error {
  status = 403;
  constructor(message: string) {
    super(message);
    this.name = 'TenantSecurityError';
  }
}

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

/**
 * Throws TenantSecurityError if the caller cannot legitimately operate on
 * `companyId`. Lives here (not in the endpoints) so every entry point —
 * HTTP, cron, bridge-sync, future workers — is forced through the same gate.
 */
export async function assertTenantAccess(
  client: SupabaseClient,
  args: { companyId: string; userId: string | null; triggeredBy: EngineTriggeredBy },
): Promise<void> {
  if (!args.companyId) {
    throw new TenantSecurityError('companyId is required');
  }

  // System-level callers (cron, bridge_sync, system) don't have a user.
  if (!args.userId) {
    if (args.triggeredBy === 'manual') {
      throw new TenantSecurityError('manual trigger requires userId');
    }
    return;
  }

  // User-initiated call: confirm the user owns the company or is a member.
  const { data: ownerRow, error: ownerErr } = await client
    .from('companies')
    .select('id, user_id, deleted_at')
    .eq('id', args.companyId)
    .maybeSingle();
  if (ownerErr) throw ownerErr;
  if (!ownerRow || ownerRow.deleted_at) {
    throw new TenantSecurityError('company not found');
  }
  if (ownerRow.user_id === args.userId) return;

  const { data: memberRow, error: memberErr } = await client
    .from('company_members')
    .select('id')
    .eq('company_id', args.companyId)
    .eq('user_id', args.userId)
    .maybeSingle();
  if (memberErr) throw memberErr;
  if (!memberRow) {
    throw new TenantSecurityError('user has no access to companyId');
  }
}

async function assertRuleBelongsToCompany(
  client: SupabaseClient,
  ruleId: string,
  companyId: string,
): Promise<{ id: string; company_id: string; is_active: boolean }> {
  const { data, error } = await client
    .from('automation_rules')
    .select('id, company_id, is_active')
    .eq('id', ruleId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new TenantSecurityError('rule not found');
  if (data.company_id !== companyId) {
    throw new TenantSecurityError('rule does not belong to companyId');
  }
  if (!data.is_active) {
    throw new TenantSecurityError('rule is not active');
  }
  return data as { id: string; company_id: string; is_active: boolean };
}

async function assertTransactionsBelongToCompany(
  client: SupabaseClient,
  transactionIds: string[],
  companyId: string,
): Promise<void> {
  if (transactionIds.length === 0) return;
  const { data, error } = await client
    .from('transactions')
    .select('id, company_id, deleted_at')
    .in('id', transactionIds);
  if (error) throw error;
  const found = new Set((data || []).map((r: any) => r.id));
  for (const id of transactionIds) {
    if (!found.has(id)) throw new TenantSecurityError(`transaction ${id} not found`);
  }
  for (const row of data || []) {
    if ((row as any).deleted_at) {
      throw new TenantSecurityError(`transaction ${(row as any).id} is deleted`);
    }
    if ((row as any).company_id !== companyId) {
      throw new TenantSecurityError(`transaction ${(row as any).id} does not belong to companyId`);
    }
  }
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

async function loadRules(
  client: SupabaseClient,
  companyId: string,
  ruleId?: string,
): Promise<NormalizedRule[]> {
  let query = client
    .from('automation_rules')
    .select('*')
    .eq('is_active', true)
    .eq('company_id', companyId)
    .not('target_category_id', 'is', null);

  if (ruleId) query = query.eq('id', ruleId);

  const { data: rulesData, error } = await query;
  if (error) throw error;
  const rules = (rulesData || []) as any[];
  if (rules.length === 0) return [];

  // Extra conditions (batched).
  const ruleIds = rules.map((r) => r.id);
  const extraByRule = new Map<string, RuleCondition[]>();
  const chunkSize = 100;
  for (let i = 0; i < ruleIds.length; i += chunkSize) {
    const batch = ruleIds.slice(i, i + chunkSize);
    const { data: extras, error: condErr } = await client
      .from('automation_rule_conditions')
      .select('*')
      .in('rule_id', batch);
    if (condErr) throw condErr;
    for (const c of (extras || []) as any[]) {
      const arr = extraByRule.get(c.rule_id) || [];
      arr.push({
        condition_field: c.condition_field,
        condition_operator: c.condition_operator,
        condition_value: c.condition_value,
      });
      extraByRule.set(c.rule_id, arr);
    }
  }

  // Category types for type guard / target validity.
  const categoryIds = [...new Set(rules.map((r) => r.target_category_id).filter(Boolean))];
  const categoryTypeMap = new Map<string, string | null>();
  if (categoryIds.length > 0) {
    const { data: cats, error: catErr } = await client
      .from('categories')
      .select('id, type')
      .in('id', categoryIds);
    if (catErr) throw catErr;
    for (const c of (cats || []) as any[]) {
      categoryTypeMap.set(c.id, c.type ?? null);
    }
  }

  const normalized: NormalizedRule[] = rules
    .filter((r) => r.condition_field && r.condition_operator && r.condition_value)
    .map((r) => {
      const extras = extraByRule.get(r.id) || [];
      const allConds: RuleCondition[] = [
        {
          condition_field: r.condition_field,
          condition_operator: r.condition_operator,
          condition_value: r.condition_value,
        },
        ...extras,
      ];
      const specificity = r.specificity_score ?? computeSpecificityScore(allConds);
      // categoryTypeMap.has(id) === false means category doesn't exist anymore.
      const knownCategory = categoryTypeMap.has(r.target_category_id);
      const targetType = knownCategory ? categoryTypeMap.get(r.target_category_id) ?? null : 'INVALID';
      return {
        id: r.id,
        name: r.name ?? '',
        company_id: r.company_id,
        user_id: r.user_id,
        is_active: r.is_active,
        priority: r.priority ?? 100,
        specificity_score: Number(specificity) || 0,
        created_at: r.created_at ?? new Date().toISOString(),
        target_category_id: r.target_category_id,
        target_category_type: targetType,
        conditions: allConds,
        match_count: r.match_count || 0,
      };
    })
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (b.specificity_score !== a.specificity_score) return b.specificity_score - a.specificity_score;
      return a.created_at.localeCompare(b.created_at);
    });

  return normalized;
}

async function loadCandidateTransactions(
  client: SupabaseClient,
  companyId: string,
  transactionIds?: string[],
): Promise<TransactionRow[]> {
  // When transactionIds is provided we honour it strictly (still scoped by company).
  // Otherwise we pull every uncategorized non-deleted transaction for the company.
  const pageSize = 1000;
  const out: TransactionRow[] = [];

  if (transactionIds && transactionIds.length > 0) {
    const chunkSize = 200;
    for (let i = 0; i < transactionIds.length; i += chunkSize) {
      const batch = transactionIds.slice(i, i + chunkSize);
      const { data, error } = await client
        .from('transactions')
        .select(
          'id, description, amount, type, category_id, company_id, user_id, bank_account_name, merchant_key, normalized_description, deleted_at',
        )
        .eq('company_id', companyId)
        .in('id', batch);
      if (error) throw error;
      for (const row of (data || []) as TransactionRow[]) out.push(row);
    }
    return out;
  }

  let page = 0;
  while (true) {
    const { data, error } = await client
      .from('transactions')
      .select(
        'id, description, amount, type, category_id, company_id, user_id, bank_account_name, merchant_key, normalized_description, deleted_at',
      )
      .eq('company_id', companyId)
      .is('category_id', null)
      .is('deleted_at', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data as TransactionRow[]) out.push(row);
    if (data.length < pageSize) break;
    page++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Matching & decision
// ---------------------------------------------------------------------------

function matchesRule(tx: TransactionRow, rule: NormalizedRule): boolean {
  if (!rule.conditions.length) return false;
  const txLike = {
    amount: Number(tx.amount) || 0,
    description: tx.description ?? '',
    type: tx.type ?? '',
    bank_account_name: tx.bank_account_name,
    merchant_key: tx.merchant_key,
    normalized_description: tx.normalized_description,
  };
  return rule.conditions.every((c) => matchesAutomationCondition(c, txLike));
}

interface DecisionContext {
  rules: NormalizedRule[];
  ruleScope?: string; // when present, only this rule was evaluated
}

function decideForTransaction(
  tx: TransactionRow,
  ctx: DecisionContext,
): TransactionDecision {
  // Already categorized: skipped first, regardless of any match attempt.
  if (tx.category_id) {
    return {
      transaction_id: tx.id,
      decision: 'already_categorized',
      winning_rule_id: null,
      target_category_id: tx.category_id,
      reason_codes: ['already_categorized'],
    };
  }

  // Build candidates by testing each rule. Track special "would have matched
  // but invalid" outcomes (type_mismatch / target_category_invalid) so the
  // caller can explain rejections instead of swallowing them as no_match.
  const matched: NormalizedRule[] = [];
  let typeMismatch: NormalizedRule | null = null;
  let invalidTarget: NormalizedRule | null = null;

  for (const rule of ctx.rules) {
    if (rule.target_category_type === 'INVALID') {
      // Only surface this reason if the rule otherwise matched the row.
      if (matchesRule(tx, rule)) invalidTarget ??= rule;
      continue;
    }
    if (
      rule.target_category_type &&
      tx.type &&
      rule.target_category_type !== tx.type
    ) {
      if (matchesRule(tx, rule)) typeMismatch ??= rule;
      continue;
    }
    if (matchesRule(tx, rule)) matched.push(rule);
  }

  if (matched.length === 0) {
    if (invalidTarget) {
      return {
        transaction_id: tx.id,
        decision: 'target_category_invalid',
        winning_rule_id: invalidTarget.id,
        target_category_id: invalidTarget.target_category_id,
        reason_codes: ['target_category_invalid'],
      };
    }
    if (typeMismatch) {
      return {
        transaction_id: tx.id,
        decision: 'type_mismatch',
        winning_rule_id: typeMismatch.id,
        target_category_id: typeMismatch.target_category_id,
        reason_codes: ['type_mismatch'],
      };
    }
    return {
      transaction_id: tx.id,
      decision: 'no_match',
      winning_rule_id: null,
      target_category_id: null,
      reason_codes: ['no_match'],
    };
  }

  if (matched.length >= 2) {
    const [a, b] = matched;
    if (
      a.target_category_id !== b.target_category_id &&
      isConflictingScore(a.specificity_score, b.specificity_score)
    ) {
      // Priority is the user's manual lever. If the top two candidates have
      // DIFFERENT priorities, the higher one wins outright — no conflict.
      // Rules are pre-sorted by priority DESC (see loadRules), so matched[0]
      // is the higher-priority candidate. Real conflict only remains when the
      // user has not classified them (equal priorities + close specificity +
      // different targets).
      if (a.priority !== b.priority) {
        return {
          transaction_id: tx.id,
          decision: 'applied',
          winning_rule_id: a.id,
          target_category_id: a.target_category_id,
          competing_rules: matched.slice(0, 3).map((r) => r.id),
          reason_codes: ['rule_matched', 'priority_tiebreak'],
        };
      }
      return {
        transaction_id: tx.id,
        decision: 'conflict',
        winning_rule_id: null,
        target_category_id: null,
        competing_rules: matched.slice(0, 3).map((r) => r.id),
        reason_codes: ['conflict_specificity_close'],
      };
    }
  }

  const winning = matched[0];
  return {
    transaction_id: tx.id,
    decision: 'applied',
    winning_rule_id: winning.id,
    target_category_id: winning.target_category_id,
    reason_codes: ['rule_matched'],
  };
}


// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function loggerTriggeredBy(t: EngineTriggeredBy): LoggerTriggeredBy {
  // automationRunLogger only knows about 'manual' | 'cron' | 'user' | 'system'.
  // Map our richer EngineTriggeredBy down to one of these.
  if (t === 'bridge_sync') return 'system';
  return t;
}

async function persistUpdates(
  client: SupabaseClient,
  decisions: TransactionDecision[],
): Promise<number> {
  const updatesByCategory = new Map<string, string[]>();
  for (const d of decisions) {
    if (d.decision !== 'applied' || !d.target_category_id) continue;
    const arr = updatesByCategory.get(d.target_category_id) || [];
    arr.push(d.transaction_id);
    updatesByCategory.set(d.target_category_id, arr);
  }

  let updated = 0;
  const chunkSize = 100;
  for (const [categoryId, ids] of updatesByCategory) {
    for (let i = 0; i < ids.length; i += chunkSize) {
      const batch = ids.slice(i, i + chunkSize);
      const { error } = await client
        .from('transactions')
        .update({ category_id: categoryId })
        .in('id', batch)
        .is('category_id', null); // idempotence guard — never overwrite
      if (error) throw error;
      updated += batch.length;
    }
  }
  return updated;
}

function decisionsToRunItems(
  decisions: TransactionDecision[],
  rulesById: Map<string, NormalizedRule>,
): RunItemInput[] {
  const items: RunItemInput[] = [];
  for (const d of decisions) {
    if (d.decision === 'no_match' || d.decision === 'already_categorized') continue;
    const rule = d.winning_rule_id ? rulesById.get(d.winning_rule_id) : null;
    const status: RunItemInput['status'] =
      d.decision === 'applied' ? 'applied' : 'skipped_conflict';
    items.push({
      rule_id: d.winning_rule_id,
      transaction_id: d.transaction_id,
      previous_category_id: null,
      new_category_id: d.decision === 'applied' ? d.target_category_id : null,
      confidence: d.decision === 'applied' ? 1 : 0,
      confidence_source: 'exact_rule',
      reason_codes: d.reason_codes,
      evidence: {
        decision: d.decision,
        rule_name: rule?.name,
        specificity: rule?.specificity_score,
        competing_rules: d.competing_rules,
      },
      status,
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function applyAutomationRulesForCompany(
  args: ApplyArgs,
): Promise<ApplyResult> {
  // 1. Tenant security — non-negotiable.
  await assertTenantAccess(args.client, {
    companyId: args.companyId,
    userId: args.userId,
    triggeredBy: args.triggeredBy,
  });

  if (args.ruleId) {
    await assertRuleBelongsToCompany(args.client, args.ruleId, args.companyId);
  }
  if (args.transactionIds && args.transactionIds.length > 0) {
    await assertTransactionsBelongToCompany(
      args.client,
      args.transactionIds,
      args.companyId,
    );
  }

  // 2. Load.
  const rules = await loadRules(args.client, args.companyId, args.ruleId);
  if (rules.length === 0) {
    return { runId: null, matched: 0, applied: 0, skippedConflict: 0, decisions: [] };
  }

  const transactions = await loadCandidateTransactions(
    args.client,
    args.companyId,
    args.transactionIds,
  );

  // 3. Decide.
  const ctx: DecisionContext = { rules };
  const decisions: TransactionDecision[] = transactions.map((tx) => decideForTransaction(tx, ctx));

  const matched = decisions.filter((d) => d.decision === 'applied' || d.decision === 'conflict').length;
  const skippedConflict = decisions.filter((d) => d.decision === 'conflict').length;

  // 4. Persist (skip if dry run).
  let applied = 0;
  let runId: string | null = null;

  if (!args.dryRun) {
    applied = await persistUpdates(args.client, decisions);

    const rulesById = new Map(rules.map((r) => [r.id, r]));
    runId = await createRun(args.client, {
      rule_id: args.ruleId ?? null,
      company_id: args.companyId,
      user_id: args.userId ?? rules[0].user_id, // run row needs a user_id
      triggered_by: loggerTriggeredBy(args.triggeredBy),
      mode: 'apply',
      metadata: {
        engine_trigger: args.triggeredBy,
        rules_count: rules.length,
        scope_rule_id: args.ruleId ?? null,
        scope_transaction_ids: args.transactionIds ?? null,
      },
    });
    await appendRunItems(args.client, runId, decisionsToRunItems(decisions, rulesById));
    await finishRun(args.client, runId, { matched, applied, skippedConflict });

    // Update per-rule match counters.
    const perRule = new Map<string, number>();
    for (const d of decisions) {
      if (d.decision !== 'applied' || !d.winning_rule_id) continue;
      perRule.set(d.winning_rule_id, (perRule.get(d.winning_rule_id) ?? 0) + 1);
    }
    for (const [ruleId, count] of perRule) {
      const rule = rulesById.get(ruleId);
      if (!rule) continue;
      await args.client
        .from('automation_rules')
        .update({ match_count: rule.match_count + count })
        .eq('id', ruleId);
    }
  }

  return { runId, matched, applied, skippedConflict, decisions };
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

export interface PreviewArgs {
  client: SupabaseClient;
  companyId: string;
  userId: string | null;
  triggeredBy: EngineTriggeredBy;
  conditions: PreviewCondition[];
  target_category_id: string | null;
  rule_id_being_edited?: string | null;
}

export async function previewRule(args: PreviewArgs): Promise<PreviewResult> {
  await assertTenantAccess(args.client, {
    companyId: args.companyId,
    userId: args.userId,
    triggeredBy: args.triggeredBy,
  });
  if (args.rule_id_being_edited) {
    await assertRuleBelongsToCompany(args.client, args.rule_id_being_edited, args.companyId);
  }

  // Target category type (drives type guard inside computePreview).
  let targetCategoryType: 'income' | 'expense' | null = null;
  if (args.target_category_id) {
    const { data: cat } = await args.client
      .from('categories')
      .select('type')
      .eq('id', args.target_category_id)
      .maybeSingle();
    if (cat?.type === 'income' || cat?.type === 'expense') {
      targetCategoryType = cat.type;
    }
  }

  // Transactions for the company (all, not just uncategorized — preview needs
  // historical evidence to compute safety_score and existing distribution).
  const pageSize = 1000;
  let page = 0;
  const transactions: PreviewTransaction[] = [];
  while (true) {
    const { data, error } = await args.client
      .from('transactions')
      .select('id, description, amount, type, category_id, bank_account_name, date, merchant_key, normalized_description')
      .eq('company_id', args.companyId)
      .is('deleted_at', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data as any[]) {
      transactions.push({
        id: row.id,
        description: row.description ?? '',
        amount: row.amount ?? 0,
        type: row.type ?? '',
        category_id: row.category_id,
        bank_account_name: row.bank_account_name,
        date: row.date,
        merchant_key: row.merchant_key,
        normalized_description: row.normalized_description,
      });
    }
    if (data.length < pageSize) break;
    page++;
  }

  // Other rules for conflict detection.
  const { data: otherRulesData } = await args.client
    .from('automation_rules')
    .select('id, name, target_category_id, condition_field, condition_operator, condition_value')
    .eq('company_id', args.companyId)
    .eq('is_active', true);

  const otherRules: PreviewExistingRule[] = [];
  if (otherRulesData && otherRulesData.length > 0) {
    const ruleIds = (otherRulesData as any[]).map((r) => r.id);
    const { data: extraConds } = await args.client
      .from('automation_rule_conditions')
      .select('rule_id, condition_field, condition_operator, condition_value')
      .in('rule_id', ruleIds);

    const condsByRule = new Map<string, PreviewCondition[]>();
    for (const c of (extraConds || []) as any[]) {
      const arr = condsByRule.get(c.rule_id) || [];
      arr.push({
        condition_field: c.condition_field,
        condition_operator: c.condition_operator,
        condition_value: c.condition_value,
      });
      condsByRule.set(c.rule_id, arr);
    }

    for (const r of otherRulesData as any[]) {
      const extras = condsByRule.get(r.id);
      const cs: PreviewCondition[] =
        extras && extras.length > 0
          ? extras
          : [
              {
                condition_field: r.condition_field,
                condition_operator: r.condition_operator,
                condition_value: r.condition_value,
              },
            ];
      otherRules.push({
        id: r.id,
        name: r.name,
        target_category_id: r.target_category_id,
        conditions: cs,
      });
    }
  }

  return computePreview(
    {
      conditions: args.conditions,
      target_category_id: args.target_category_id,
      target_category_type: targetCategoryType,
      rule_id_being_edited: args.rule_id_being_edited ?? null,
    },
    transactions,
    otherRules,
  );
}

// ---------------------------------------------------------------------------
// Test-only exports — kept under a single namespace so production code stays
// off them. Allows the engine to be unit-tested without spinning up Supabase.
// ---------------------------------------------------------------------------
export const __test = {
  decideForTransaction,
  matchesRule,
};
