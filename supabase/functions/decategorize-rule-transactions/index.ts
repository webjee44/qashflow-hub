import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";
import {
  matchesAutomationCondition,
  type AutomationRuleConditionLikeCore,
  type TransactionLikeCore,
} from "../_shared/automationRuleMatchingCore.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { rule_id } = await req.json();
    if (!rule_id) {
      return new Response(JSON.stringify({ error: "rule_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the rule
    const { data: rule, error: ruleError } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("id", rule_id)
      .single();

    if (ruleError || !rule) {
      return new Response(JSON.stringify({ error: "Rule not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user has access to this rule's company
    if (rule.company_id) {
      const { data: access } = await supabase.rpc("has_company_access", {
        _user_id: user.id,
        _company_id: rule.company_id,
      });
      if (!access) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch conditions for this rule
    const { data: conditions } = await supabase
      .from("automation_rule_conditions")
      .select("condition_field, condition_operator, condition_value")
      .eq("rule_id", rule_id);

    const ruleConditions: AutomationRuleConditionLikeCore[] =
      conditions && conditions.length > 0
        ? conditions
        : [
            {
              condition_field: rule.condition_field,
              condition_operator: rule.condition_operator,
              condition_value: rule.condition_value,
            },
          ];

    // Fetch transactions categorized with this rule's target category
    if (!rule.target_category_id) {
      return new Response(JSON.stringify({ decategorized: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const query = supabase
      .from("transactions")
      .select("id, description, amount, type")
      .eq("category_id", rule.target_category_id)
      .is("deleted_at", null);

    if (rule.company_id) {
      query.eq("company_id", rule.company_id);
    }

    const { data: transactions, error: txError } = await query;
    if (txError) throw txError;

    // Filter transactions that match this rule's conditions
    const matchingIds: string[] = [];
    for (const tx of transactions || []) {
      const txLike: TransactionLikeCore = {
        amount: tx.amount,
        description: tx.description,
        type: tx.type,
      };
      const allMatch = ruleConditions.every((c) =>
        matchesAutomationCondition(c, txLike)
      );
      if (allMatch) {
        matchingIds.push(tx.id);
      }
    }

    // Decategorize in batches of 500
    let decategorized = 0;
    const BATCH_SIZE = 500;
    for (let i = 0; i < matchingIds.length; i += BATCH_SIZE) {
      const batch = matchingIds.slice(i, i + BATCH_SIZE);
      const { error: updateError, count } = await supabase
        .from("transactions")
        .update({ category_id: null })
        .in("id", batch);

      if (updateError) throw updateError;
      decategorized += count ?? batch.length;
    }

    return new Response(JSON.stringify({ decategorized }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("decategorize-rule-transactions error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
