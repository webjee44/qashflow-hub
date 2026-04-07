import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    if (!SLACK_API_KEY) throw new Error("SLACK_API_KEY is not configured");

    const payload = await req.json();
    const { user_id, full_name, email, company_name } = payload;

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the Slack message
    const displayName = full_name || email || "Utilisateur inconnu";
    const companyInfo = company_name ? ` — *${company_name}*` : "";

    const slackMessage = {
      channel: "#leadsqashflow",
      text: `🎉 Nouvel onboarding complété !`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🎉 *Nouvel onboarding complété !*\n\n👤 *${displayName}*${companyInfo}\n📧 ${email || "—"}\n\nL'utilisateur a finalisé son parcours d'inscription et est prêt à utiliser Qashflow.`,
          },
        },
      ],
    };

    const response = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": SLACK_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(slackMessage),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error("Slack API error:", data.error);
      throw new Error(`Slack API error: ${data.error}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error sending Slack notification:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
