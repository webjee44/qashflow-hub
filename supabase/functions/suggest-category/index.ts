import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CategoryInput {
  id: string;
  name: string;
  type: "income" | "expense";
}

interface RequestBody {
  description: string;
  type: "income" | "expense";
  categories: CategoryInput[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { description, type, categories }: RequestBody = await req.json();

    if (!description || !type || !categories?.length) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter categories by transaction type
    const relevantCategories = categories.filter((c) => c.type === type);

    if (relevantCategories.length === 0) {
      return new Response(
        JSON.stringify({ error: "No matching categories for this transaction type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const categoryList = relevantCategories.map((c) => c.name).join(", ");

    const systemPrompt = `Tu es un expert en catégorisation de transactions bancaires françaises pour les entreprises.
Ton rôle est d'analyser le libellé d'une transaction et de choisir la catégorie la plus appropriée parmi celles proposées.

Règles importantes :
- Une transaction de type "expense" (décaissement) doit être catégorisée avec une catégorie de dépense
- Une transaction de type "income" (encaissement) doit être catégorisée avec une catégorie de revenu
- Analyse bien le libellé bancaire qui peut contenir des codes, des noms de société, des références

Exemples de correspondances courantes :
- URSSAF, ACOSS → Cotisations sociales / Charges sociales
- AMAZON, FNAC → Fournitures / Achats
- NETFLIX, SPOTIFY, APPLE → Abonnements
- OVH, GANDI, AWS → Hébergement / Informatique
- ORANGE, SFR, FREE → Téléphone / Internet
- ENGIE, EDF → Énergie / Électricité
- LOYER, BAIL → Loyer
- SNCF, UBER → Déplacements / Transport
- RESTO, DELIVEROO → Restauration
- ASSURANCE, AXA, MAIF → Assurances
- BANQUE, FRAIS, COMMISSION → Frais bancaires
- EXPERT COMPTABLE, COMPTA → Honoraires / Comptabilité
- VIREMENT DE, VIREMENT RECU → selon le contexte (client, salaire, etc.)

Réponds UNIQUEMENT en JSON valide avec ce format exact :
{"categoryName": "NomExactDeLaCategorie", "confidence": 0.85}

Le champ confidence est un nombre entre 0 et 1 représentant ta confiance dans la suggestion.
Le categoryName DOIT être exactement un des noms de catégorie fournis.`;

    const userPrompt = `Transaction à catégoriser :
- Libellé : "${description}"
- Type : ${type === "expense" ? "décaissement (dépense)" : "encaissement (revenu)"}

Catégories disponibles : ${categoryList}

Choisis la catégorie la plus appropriée.`;

    console.log(`Suggesting category for: "${description}" (${type})`);
    console.log(`Available categories: ${categoryList}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_category",
              description: "Return the suggested category for the transaction",
              parameters: {
                type: "object",
                properties: {
                  categoryName: {
                    type: "string",
                    description: "The exact name of the suggested category from the list",
                  },
                  confidence: {
                    type: "number",
                    description: "Confidence level between 0 and 1",
                  },
                },
                required: ["categoryName", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_category" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    console.log("AI response:", JSON.stringify(aiResponse));

    // Extract tool call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response");
      return new Response(
        JSON.stringify({ error: "Invalid AI response format" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const suggestion = JSON.parse(toolCall.function.arguments);
    const { categoryName, confidence } = suggestion;

    // Find the matching category
    const matchedCategory = relevantCategories.find(
      (c) => c.name.toLowerCase() === categoryName.toLowerCase()
    );

    if (!matchedCategory) {
      console.log(`Category "${categoryName}" not found in available categories`);
      // Try fuzzy match
      const fuzzyMatch = relevantCategories.find(
        (c) =>
          c.name.toLowerCase().includes(categoryName.toLowerCase()) ||
          categoryName.toLowerCase().includes(c.name.toLowerCase())
      );
      
      if (fuzzyMatch) {
        console.log(`Fuzzy matched to: ${fuzzyMatch.name}`);
        return new Response(
          JSON.stringify({
            categoryId: fuzzyMatch.id,
            categoryName: fuzzyMatch.name,
            confidence: Math.max(0.5, confidence - 0.1),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Category not matched" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Suggested: ${matchedCategory.name} (confidence: ${confidence})`);

    return new Response(
      JSON.stringify({
        categoryId: matchedCategory.id,
        categoryName: matchedCategory.name,
        confidence: Math.min(1, Math.max(0, confidence)),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("suggest-category error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
