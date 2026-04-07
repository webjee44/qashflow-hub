import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(200),
  secret: z.string().min(1),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
      return new Response(JSON.stringify({ error: `Validation failed: ${errors}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { emails, secret } = parsed.data;

    // Auth via shared secret
    const bridgeSecret = Deno.env.get("BRIDGE_SECRET");
    if (!bridgeSecret || secret !== bridgeSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Normalize emails to lowercase
    const normalizedEmails = emails.map((e) => e.toLowerCase());

    // Query auth.users for matching emails via admin API
    // listUsers has pagination, we need to handle it for up to 200 emails
    const matchedUsers: Map<string, { id: string; email: string; created_at: string }> = new Map();

    // Fetch users in batches (listUsers returns max 1000 per page)
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });

    if (usersError) {
      console.error("[check-clients] Error listing users:", usersError.message);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter to only requested emails
    for (const user of usersData.users) {
      const userEmail = user.email?.toLowerCase();
      if (userEmail && normalizedEmails.includes(userEmail)) {
        matchedUsers.set(userEmail, {
          id: user.id,
          email: userEmail,
          created_at: user.created_at,
        });
      }
    }

    // For matched users, get their organization info
    const clients: Record<string, { org_name: string; status: string; since: string }> = {};

    if (matchedUsers.size > 0) {
      const userIds = Array.from(matchedUsers.values()).map((u) => u.id);

      const { data: memberships, error: memError } = await supabaseAdmin
        .from("organization_members")
        .select("user_id, organization_id, joined_at, organizations(name, subscription_status)")
        .in("user_id", userIds);

      if (memError) {
        console.error("[check-clients] Error fetching memberships:", memError.message);
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Build lookup: user_id → org info
      const orgByUserId = new Map<string, { org_name: string; status: string; since: string }>();
      for (const m of memberships || []) {
        const org = m.organizations as any;
        if (org) {
          orgByUserId.set(m.user_id, {
            org_name: org.name || "N/A",
            status: org.subscription_status || "unknown",
            since: m.joined_at || "",
          });
        }
      }

      // Map back to emails
      for (const [email, user] of matchedUsers) {
        const orgInfo = orgByUserId.get(user.id);
        clients[email] = orgInfo || {
          org_name: "N/A",
          status: "no_org",
          since: user.created_at,
        };
      }
    }

    return new Response(JSON.stringify({ clients }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[check-clients] Unexpected error:", message);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
