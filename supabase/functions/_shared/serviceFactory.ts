import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { TransactionRepository } from './repositories/TransactionRepository.ts';
import { AutomationRepository } from './repositories/AutomationRepository.ts';
import { InvoiceRepository } from './repositories/InvoiceRepository.ts';

export interface SupabaseServices {
  supabaseAdmin: SupabaseClient;
  transactionRepo: TransactionRepository;
  automationRepo: AutomationRepository;
  invoiceRepo: InvoiceRepository;
}

/**
 * Factory centralisant l'instanciation du client Supabase admin
 * et de tous les repositories en un seul appel.
 */
export function createSupabaseServices(): SupabaseServices {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  return {
    supabaseAdmin,
    transactionRepo: new TransactionRepository(supabaseAdmin),
    automationRepo: new AutomationRepository(supabaseAdmin),
    invoiceRepo: new InvoiceRepository(supabaseAdmin),
  };
}
