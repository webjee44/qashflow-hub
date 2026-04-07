import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";
import {
  matchesAutomationCondition,
  type AutomationRuleConditionLikeCore,
  type TransactionLikeCore,
} from "../_shared/automationRuleMatchingCore.ts";

Deno.serve(async (req) => {
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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user from JWT
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
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

    // Fetch the rule (with service role to bypass RLS since we'll verify access)
    const { data: rule, error: ruleError } = await supabaseAdmin
      .from("automation_rules")
      .select("*, automation_rule_conditions(*)")
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
      const { data: hasAccess } = await supabaseAdmin.rpc("has_company_access", {
        _user_id: user.id,
        _company_id: rule.company_id,
      });
      if (!hasAccess) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (rule.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!rule.target_category_id) {
      return new Response(JSON.stringify({ updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build conditions list: primary + additional conditions
    const conditions: AutomationRuleConditionLikeCore[] = [
      {
        condition_field: rule.condition_field,
        condition_operator: rule.condition_operator,
        condition_value: rule.condition_value,
      },
      ...(rule.automation_rule_conditions || []).map((c: any) => ({
        condition_field: c.condition_field,
        condition_operator: c.condition_operator,
        condition_value: c.condition_value,
      })),
    ];

    // Fetch transactions with this category in this company
    const query = supabaseAdmin
      .from("transactions")
      .select("id, description, amount, type")
      .eq("category_id", rule.target_category_id)
      .is("deleted_at", null);

    if (rule.company_id) {
      query.eq("company_id", rule.company_id);
    } else {
      query.eq("user_id", rule.user_id);
    }

    const { data: transactions, error: txError } = await query;
    if (txError) throw txError;

    // Match transactions against rule conditions
    const matchingIds: string[] = [];
    for (const tx of transactions || []) {
      const txLike: TransactionLikeCore = {
        amount: tx.amount,
        description: tx.description || "",
        type: tx.type,
      };

      const allMatch = conditions.every((cond) =>
        matchesAutomationCondition(cond, txLike)
      );

      if (allMatch) {
        matchingIds.push(tx.id);
      }
    }

    if (matchingIds.length === 0) {
      return new Response(JSON.stringify({ updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decategorize in batches of 500
    let totalUpdated = 0;
    for (let i = 0; i < matchingIds.length; i += 500) {
      const batch = matchingIds.slice(i, i + 500);
      const { count, error: updateError } = await supabaseAdmin
        .from("transactions")
        .update({ category_id: null })
        .in("id", batch);

      if (updateError) throw updateError;
      totalUpdated += count || batch.length;
    }

    return new Response(JSON.stringify({ updated: totalUpdated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
