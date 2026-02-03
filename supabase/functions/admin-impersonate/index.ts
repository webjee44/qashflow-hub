import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user client to validate auth
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the caller's authentication
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerId = user.id;
    console.log("Caller ID:", callerId);

    // Create service role client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the caller is a superadmin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "superadmin")
      .maybeSingle();

    if (roleError || !roleData) {
      console.error("Not a superadmin:", roleError);
      return new Response(
        JSON.stringify({ error: "Accès refusé - Vous devez être superadmin" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the target user ID from the request body
    const { targetUserId } = await req.json();

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: "ID utilisateur cible requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Impersonating user:", targetUserId);

    // Verify the target user exists
    const { data: targetUser, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
    
    if (targetUserError || !targetUser?.user) {
      console.error("Target user not found:", targetUserError);
      return new Response(
        JSON.stringify({ error: "Utilisateur cible non trouvé" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a magic link for the target user with proper hashed token
    const origin = req.headers.get("origin") || "https://pennylane-cash-flow-buddy.lovable.app";
    
    // Use /impersonate-landing to handle session switch cleanly
    const redirectPath = `${origin}/impersonate-landing`;
    
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.user.email!,
      options: {
        redirectTo: redirectPath,
      },
    });

    if (linkError || !linkData?.properties) {
      console.error("Error generating magic link:", linkError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de la génération du lien d'impersonation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // The hashed_token can be used to verify the OTP
    const { hashed_token, verification_type } = linkData.properties;
    
    // Build the verification URL that Supabase Auth will process
    // Format: /auth/v1/verify?token=HASHED_TOKEN&type=TYPE&redirect_to=URL
    const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${hashed_token}&type=${verification_type}&redirect_to=${encodeURIComponent(redirectPath)}`;

    // Log this impersonation action
    await supabaseAdmin.from("audit_logs").insert({
      action: "impersonate",
      table_name: "auth.users",
      record_id: targetUserId,
      user_id: callerId,
      metadata: {
        target_email: targetUser.user.email,
        impersonated_at: new Date().toISOString(),
      },
    });

    console.log("Impersonation link generated successfully for:", targetUser.user.email);

    return new Response(
      JSON.stringify({
        success: true,
        impersonationUrl: verifyUrl,
        targetEmail: targetUser.user.email,
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
