import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate caller auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerId = user.id;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify superadmin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "superadmin")
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: "Accès refusé - Vous devez être superadmin" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { targetUserId } = await req.json();
    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: "ID utilisateur cible requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify target user exists
    const { data: targetUser, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
    if (targetUserError || !targetUser?.user) {
      return new Response(
        JSON.stringify({ error: "Utilisateur cible non trouvé" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetEmail = targetUser.user.email!;

    // Generate a magic link to get the OTP token
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail,
    });

    if (linkError || !linkData?.properties) {
      console.error("Error generating link:", linkError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de la génération du lien" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the impersonation
    await supabaseAdmin.from("audit_logs").insert({
      action: "impersonate",
      table_name: "auth.users",
      record_id: targetUserId,
      user_id: callerId,
      metadata: {
        target_email: targetEmail,
        impersonated_at: new Date().toISOString(),
      },
    });

    // Return the OTP token and email — client will call verifyOtp directly
    return new Response(
      JSON.stringify({
        success: true,
        email: targetEmail,
        token: linkData.properties.hashed_token,
        type: linkData.properties.verification_type,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erreur serveur inattendue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
