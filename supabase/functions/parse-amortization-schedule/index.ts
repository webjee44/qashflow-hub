import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface AmortizationData {
  loan_name: string | null;
  bank_name: string | null;
  loan_reference: string | null;
  initial_amount: number;
  interest_rate: number | null;
  duration_months: number | null;
  monthly_payment: number | null;
  monthly_insurance: number | null;
  start_date: string | null;
  outstanding_capital: number | null;
  total_interest: number | null;
  loan_type: 'loan' | 'lease' | null;
  confidence_score: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error("JWT validation failed:", claimsError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("User authenticated:", claimsData.claims.sub);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { pdf_base64 } = await req.json();

    if (!pdf_base64) {
      return new Response(
        JSON.stringify({ error: "pdf_base64 is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Parsing amortization schedule PDF...");

    // AI prompt optimized for French bank amortization schedules
    const extractionPrompt = `Tu es un expert en analyse de tableaux d'amortissement bancaires français.
Analyse ce document PDF et extrais les informations du prêt au format JSON strict.

RÈGLES IMPORTANTES:
- Cherche le montant INITIAL emprunté (le capital de départ, pas le restant dû)
- Le taux est généralement en % annuel (TEG, TAEG ou taux nominal)
- La mensualité peut inclure ou non l'assurance - prends la mensualité principale (hors assurance si séparée)
- La durée peut être calculée = nombre de lignes d'échéances dans le tableau
- Pour la date, prends la première échéance visible (format YYYY-MM-DD)
- Le nom du prêt peut être: "PRET PROFESSIONNEL", "CREDIT IMMOBILIER", "PRET EQUIPEMENT", etc.

Formats de tableaux courants:
- Banque Populaire : colonnes N°, Date, Terme, Échéance, Intérêts, Capital amorti, Capital restant
- CIC : colonnes Date, Type, Capital dû, Capital, Intérêts, Échéance
- LCL, Société Générale, BNP : formats similaires avec variations
- Crédit Mutuel : Date échéance, Montant échéance, Capital amorti, Intérêts, Capital restant dû

NE RENVOIE QUE LE JSON, sans texte avant ou après:
{
  "loan_name": "<nom/type du prêt ou null>",
  "bank_name": "<nom de la banque>",
  "loan_reference": "<numéro de référence du prêt ou null>",
  "initial_amount": <montant initial emprunté en euros (nombre)>,
  "interest_rate": <taux annuel en %, ex: 3.64 (nombre) ou null>,
  "duration_months": <durée totale en mois (nombre) ou null>,
  "monthly_payment": <mensualité principale en euros (nombre) ou null>,
  "monthly_insurance": <assurance mensuelle en euros si visible (nombre) ou null>,
  "start_date": "<YYYY-MM-DD de première échéance ou null>",
  "outstanding_capital": <capital restant dû actuel si visible (nombre) ou null>,
  "total_interest": <total des intérêts à payer si visible (nombre) ou null>,
  "loan_type": "loan" ou "lease" ou null,
  "confidence_score": <score de confiance de 0 à 1>
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: extractionPrompt },
          { 
            role: "user", 
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${pdf_base64}`
                }
              },
              {
                type: "text",
                text: "Analyse ce tableau d'amortissement et extrais les données du prêt au format JSON."
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Trop de requêtes, veuillez réessayer dans quelques instants." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits IA épuisés. Veuillez recharger votre compte." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("AI response:", content);

    // Parse the JSON from the AI response
    // Handle potential markdown code blocks
    let jsonString = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonString = jsonMatch[1];
    }

    let amortizationData: AmortizationData;
    try {
      amortizationData = JSON.parse(jsonString.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", jsonString);
      throw new Error("Impossible de parser la réponse. Vérifiez que le PDF est lisible.");
    }

    // Validate and sanitize the data
    const sanitizedData: AmortizationData = {
      loan_name: amortizationData.loan_name || null,
      bank_name: amortizationData.bank_name || null,
      loan_reference: amortizationData.loan_reference || null,
      initial_amount: Number(amortizationData.initial_amount) || 0,
      interest_rate: amortizationData.interest_rate != null ? Number(amortizationData.interest_rate) : null,
      duration_months: amortizationData.duration_months != null ? Number(amortizationData.duration_months) : null,
      monthly_payment: amortizationData.monthly_payment != null ? Number(amortizationData.monthly_payment) : null,
      monthly_insurance: amortizationData.monthly_insurance != null ? Number(amortizationData.monthly_insurance) : null,
      start_date: amortizationData.start_date || null,
      outstanding_capital: amortizationData.outstanding_capital != null ? Number(amortizationData.outstanding_capital) : null,
      total_interest: amortizationData.total_interest != null ? Number(amortizationData.total_interest) : null,
      loan_type: amortizationData.loan_type === 'loan' || amortizationData.loan_type === 'lease' 
        ? amortizationData.loan_type 
        : null,
      confidence_score: Math.min(1, Math.max(0, Number(amortizationData.confidence_score) || 0.5)),
    };

    // Validate that we got at least the essential data
    if (sanitizedData.initial_amount <= 0) {
      throw new Error("Impossible de déterminer le montant du prêt. Vérifiez que le document est un tableau d'amortissement.");
    }

    console.log("Extracted amortization data:", sanitizedData);

    return new Response(
      JSON.stringify(sanitizedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("parse-amortization-schedule error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erreur lors de l'analyse du tableau d'amortissement" 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
