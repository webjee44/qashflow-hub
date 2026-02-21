import { z } from 'zod';

// ============= Transaction Schema =============
export const transactionSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  amount: z.number(),
  type: z.string(),
  description: z.string().nullable(),
  category_id: z.string().uuid().nullable(),
  company_id: z.string().uuid().nullable(),
  user_id: z.string().uuid(),
  deleted_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();

// ============= Invoice Schema =============
export const invoiceSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  partner_name: z.string(),
  invoice_number: z.string().nullable(),
  invoice_date: z.string(),
  due_date: z.string(),
  amount_ht: z.number(),
  amount_ttc: z.number(),
  vat_amount: z.number(),
  status: z.string().nullable(),
  company_id: z.string().uuid().nullable(),
  user_id: z.string().uuid(),
  category_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();

// ============= Category Schema =============
export const categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  icon: z.string(),
  type: z.enum(['income', 'expense']),
  company_id: z.string().uuid().nullable(),
  user_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable(),
  vat_rate: z.number(),
  sort_order: z.number().nullable(),
  forecast_mode: z.string(),
  forecast_percent: z.number(),
  is_system: z.boolean().optional().default(false),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();
