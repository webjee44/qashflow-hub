// ============================================
// Zod Validation Schemas for Edge Functions
// ============================================

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// ========== Bridge Schemas ==========

export const bridgeAuthRequestSchema = z.object({
  action: z.enum(['create-user', 'get-auth-token']).default('get-auth-token'),
  bridge_user_uuid: z.string().uuid().optional(),
}).refine(
  (data) => data.action === 'create-user' || data.bridge_user_uuid,
  { message: 'bridge_user_uuid requis pour get-auth-token' }
);

export type BridgeAuthRequest = z.infer<typeof bridgeAuthRequestSchema>;

export const bridgeAccountsRequestSchema = z.object({
  action: z.enum(['get-accounts', 'get-transaction-categories']).default('get-accounts'),
  bridge_user_uuid: z.string().uuid(),
  company_id: z.string().uuid().optional(),
});

export type BridgeAccountsRequest = z.infer<typeof bridgeAccountsRequestSchema>;

export const bridgeSyncRequestSchema = z.object({
  action: z.enum(['full-sync', 'cron-sync']).default('full-sync'),
  bridge_user_uuid: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
}).refine(
  (data) => data.action === 'cron-sync' || (data.bridge_user_uuid && data.company_id),
  { message: 'bridge_user_uuid et company_id requis pour full-sync' }
);

export type BridgeSyncRequest = z.infer<typeof bridgeSyncRequestSchema>;

export const bridgeConnectRequestSchema = z.object({
  bridge_user_uuid: z.string().uuid(),
});

export type BridgeConnectRequest = z.infer<typeof bridgeConnectRequestSchema>;

// ========== Transaction Schemas ==========

export const categorizeTransactionRequestSchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1, 'Au moins un ID requis').max(100, 'Maximum 100 IDs'),
  companyId: z.string().uuid().optional(),
});

export type CategorizeTransactionRequest = z.infer<typeof categorizeTransactionRequestSchema>;

export const automationRuleRequestSchema = z.object({
  rule_id: z.string().uuid(),
});

export type AutomationRuleRequest = z.infer<typeof automationRuleRequestSchema>;

// ========== Validation Helper ==========

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationError {
  success: false;
  error: string;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

/**
 * Validates request data against a Zod schema
 * Returns a discriminated union for type-safe handling
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.issues
    .map(issue => `${issue.path.join('.')}: ${issue.message}`)
    .join(', ');
  
  return { success: false, error: `Validation échouée: ${errors}` };
}

/**
 * Creates a standardized validation error response
 */
export function validationErrorResponse(error: string, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error }),
    { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}
