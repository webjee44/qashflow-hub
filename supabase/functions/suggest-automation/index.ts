import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, categoryName } = await req.json();

    if (!description) {
      return new Response(
        JSON.stringify({ error: "Description requise" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.log("No LOVABLE_API_KEY, using fallback pattern extraction");
      // Fallback: extract first significant word
      const words = description.split(/\s+/).filter((w: string) => w.length > 3);
      const pattern = words[0] || description.slice(0, 10);
      
      return new Response(
        JSON.stringify({
          pattern,
          operator: 'contains',
          ruleName: `Auto: ${categoryName || 'Catégorie'} - ${pattern}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Analyzing description:", description);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite", // Modèle le plus rapide
        messages: [
          {
            role: "system",
            content: `Extrais le nom du fournisseur/marchand d'une transaction bancaire. Ignore numéros, dates, codes. Réponds en JSON: {"pattern":"NOM","operator":"contains","ruleName":"Auto: CATEGORIE - NOM"}`,
          },
          {
            role: "user",
            content: `Transaction: "${description}" | Catégorie: "${categoryName || 'Catégorie'}"`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      
      // Fallback on API error
      const words = description.split(/\s+/).filter((w: string) => w.length > 3);
      const pattern = words[0] || description.slice(0, 10);
      
      return new Response(
        JSON.stringify({
          pattern,
          operator: 'contains',
          ruleName: `Auto: ${categoryName || 'Catégorie'} - ${pattern}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    console.log("AI response:", content);

    // Parse the JSON response
    try {
      // Extract JSON from the response (might be wrapped in markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return new Response(
          JSON.stringify({
            pattern: parsed.pattern || description.split(' ')[0],
            operator: parsed.operator || 'contains',
            ruleName: parsed.ruleName || `Auto: ${categoryName} - ${parsed.pattern}`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
    }

    // Fallback if parsing fails
    const words = description.split(/\s+/).filter((w: string) => w.length > 3);
    const pattern = words[0] || description.slice(0, 10);
    
    return new Response(
      JSON.stringify({
        pattern,
        operator: 'contains',
        ruleName: `Auto: ${categoryName || 'Catégorie'} - ${pattern}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in suggest-automation:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
