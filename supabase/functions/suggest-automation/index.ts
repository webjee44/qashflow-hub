import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // AuthN: prevent unauthenticated AI credit drain
    const auth = await requireUser(req);
    if (!auth) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { description, categoryName, sampleTransactions } = await req.json();

    if (!description) {
      return new Response(
        JSON.stringify({ error: "Description requise" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.log("No LOVABLE_API_KEY, using fallback pattern extraction");
      const pattern = extractPatternLocally(description, sampleTransactions || []);
      
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
    console.log("Sample transactions count:", sampleTransactions?.length || 0);

    // Build context about recurring words to ignore
    const recurringWordsInfo = sampleTransactions && sampleTransactions.length > 0
      ? `\nTRANSACTIONS DE RÉFÉRENCE (pour détecter les patterns récurrents à ignorer) :\n${sampleTransactions.slice(0, 10).map((t: string) => `- ${t}`).join('\n')}\n\nSi un mot apparaît dans PLUSIEURS de ces transactions, c'est probablement le nom de la société du titulaire du compte → À IGNORER.`
      : '';

    const systemPrompt = `Tu es un expert en analyse de libellés bancaires français.

TÂCHE : Identifier UN SEUL MOT distinctif qui identifie le fournisseur/marchand.

RÈGLES STRICTES :
1. Retourne UN SEUL MOT (pas une combinaison de mots) car l'opérateur "contains" cherche une sous-chaîne consécutive
2. Choisis le mot le plus distinctif et spécifique au fournisseur (souvent le nom de marque/société)
3. IGNORER absolument :
   - Les codes alphanumériques (PP35634948, FA18747520, F2511348843, 20251671, etc.)
   - Les mots bancaires : CARTE, PAIEMENT, VIR, SEPA, PRLV, CB, MCC, EUR, USD, INTERNET, REMISE, EUROPRELEVEM
   - Les dates et numéros de référence
   - Les mots trop génériques (ACHAT, VENTE, SERVICE, etc.)
   - Les mots qui apparaissent dans PLUSIEURS transactions différentes (c'est le nom de la société du titulaire)
4. Exemples :
   - "Prlv Remise Europrelevem Equium Webjee" → pattern: "EQUIUM" (mot distinctif du fournisseur)
   - "CARTE CB AMAZON 1234" → pattern: "AMAZON"
   - "VIR SEPA NETFLIX" → pattern: "NETFLIX"
${recurringWordsInfo}

Réponds UNIQUEMENT en JSON : {"pattern":"MOT_UNIQUE","operator":"contains","ruleName":"Auto: CATEGORIE - MOT_UNIQUE"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `Transaction à analyser : "${description}" | Catégorie cible : "${categoryName || 'Catégorie'}"`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      
      // Fallback on API error
      const pattern = extractPatternLocally(description, sampleTransactions || []);
      
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
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return new Response(
          JSON.stringify({
            pattern: parsed.pattern || extractPatternLocally(description, sampleTransactions || []),
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
    const pattern = extractPatternLocally(description, sampleTransactions || []);
    
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

// Local pattern extraction - returns single distinctive word
function extractPatternLocally(description: string, sampleTransactions: string[]): string {
  const cleaned = description.toUpperCase();
  
  // Count word frequency across all sample transactions
  const wordFrequency = new Map<string, number>();
  sampleTransactions.forEach((t: string) => {
    const words = t.toUpperCase().split(/\s+/);
    new Set(words).forEach(w => {
      if (w.length > 2) {
        wordFrequency.set(w, (wordFrequency.get(w) || 0) + 1);
      }
    });
  });
  
  // If a word appears in more than 30% of transactions, it's probably the account holder's company name
  const threshold = Math.max(2, sampleTransactions.length * 0.3);
  
  // Expanded list of generic banking/transaction words to ignore
  const ignoreWords = new Set([
    'CARTE', 'PAIEMENT', 'VIR', 'SEPA', 'PRLV', 'CB', 'MCC', 'EUR', 'USD', 
    'INTERNET', 'REMISE', 'EUROPRELEVEM', 'PRELEVEMENT', 'VIREMENT', 'ACHAT',
    'AVOIR', 'RETRAIT', 'FRAIS', 'COMMISSION', 'SERVICE', 'DEBIT', 'CREDIT'
  ]);
  
  const words = cleaned.split(/\s+/).filter((w: string) => 
    w.length > 2 && 
    !/^\d+$/.test(w) &&
    !/^(PP\d*|FA\d*|F\d+|\d{6,})$/i.test(w) &&
    !ignoreWords.has(w) &&
    (wordFrequency.get(w) || 0) < threshold
  );
  
  // Return the first valid distinctive word, or fallback to first word truncated
  return words[0] || description.split(/\s+/)[0]?.slice(0, 10) || description.slice(0, 8).trim();
}
