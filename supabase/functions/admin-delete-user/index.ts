import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DeleteUserRequest = {
  email?: string;
  targetUserId?: string;
};

async function findUserIdByEmail(
  // Use `any` to avoid Deno/TS generic incompatibilities across supabase-js builds.
  supabaseAdmin: any,
  email: string,
): Promise<string | null> {
  const normalized = email.toLowerCase().trim();

  // Admin API doesn't support direct "get by email"; we list and match.
  // We iterate pages defensively.
  const perPage = 1000;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const match = (data?.users ?? []).find((u: any) => (u.email ?? "").toLowerCase() === normalized);
    if (match?.id) return match.id;

    // Stop early if fewer users than perPage (no more pages).
    if ((data?.users ?? []).length < perPage) break;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = user.id;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check superadmin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "superadmin")
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: "Accès refusé - superadmin requis" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as DeleteUserRequest;

    const email = body.email?.toLowerCase().trim();
    const targetUserId = body.targetUserId?.trim();

    if (!email && !targetUserId) {
      return new Response(JSON.stringify({ error: "email ou targetUserId requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resolvedUserId = targetUserId ?? (await findUserIdByEmail(supabaseAdmin, email!));
    if (!resolvedUserId) {
      return new Response(JSON.stringify({ error: "Utilisateur introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Revoke access (memberships)
    await supabaseAdmin.from("company_members").delete().eq("user_id", resolvedUserId);
    await supabaseAdmin.from("organization_members").delete().eq("user_id", resolvedUserId);

    // 2) Remove roles + profile
    await supabaseAdmin.from("user_roles").delete().eq("user_id", resolvedUserId);
    await supabaseAdmin.from("profiles").delete().eq("id", resolvedUserId);

    // 3) Anonymize audit logs (keep history but remove user link)
    await supabaseAdmin.from("audit_logs").update({ user_id: null }).eq("user_id", resolvedUserId);

    // 4) Remove pending invitations for this email (optional cleanup)
    if (email) {
      await supabaseAdmin.from("organization_invitations").delete().ilike("email", email);
    }

    // 5) Delete auth user (removes from Cloud → Users)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(resolvedUserId);
    if (deleteError) throw deleteError;

    return new Response(
      JSON.stringify({ success: true, deletedUserId: resolvedUserId, email: email ?? null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("admin-delete-user error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
