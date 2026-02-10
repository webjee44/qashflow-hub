import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PayslipData {
  gross_salary_monthly: number;
  net_salary?: number;
  position?: string;
  is_executive: boolean;
  contract_type: 'cdi' | 'cdd' | 'interim' | 'apprentice';
  employer_charges_total?: number;
  employer_charges_rate?: number;
  mutuelle_employer?: number;
  at_mp_rate?: number;
  period?: string;
  employee_name?: string;
  start_date?: string;
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

    console.log("Parsing payslip PDF...");

    // Use Lovable AI (Gemini) to extract data from the payslip
    const extractionPrompt = `Tu es un expert en analyse de fiches de paie françaises. Analyse cette fiche de paie et extrais les informations suivantes au format JSON strict.

IMPORTANT: 
- Ne renvoie QUE le JSON, sans texte avant ou après
- Les montants doivent être des nombres (pas de strings)
- Sois précis sur le statut cadre (présence AGIRC-ARRCO T2, APEC, prévoyance cadre)

Informations à extraire:
{
  "gross_salary_monthly": <salaire brut mensuel en euros>,
  "net_salary": <salaire net en euros>,
  "position": "<intitulé du poste si visible>",
  "is_executive": <true si cadre, false sinon>,
  "contract_type": "<cdi|cdd|interim|apprentice>",
  "employer_charges_total": <total cotisations patronales en euros>,
  "employer_charges_rate": <taux de charges patronales en % décimal, ex: 0.52 pour 52%>,
  "mutuelle_employer": <part patronale mutuelle/prévoyance en euros si visible>,
  "at_mp_rate": <taux AT/MP en % décimal si visible, ex: 0.0093>,
  "period": "<mois et année de la fiche, ex: Décembre 2025>",
  "employee_name": "<nom du salarié si visible>",
  "start_date": "<date d'embauche au format YYYY-MM-DD si visible>",
  "confidence_score": <score de confiance de 0 à 1>
}

Comment trouver la date d'embauche:
- Cherche les mentions "Entrée", "Date d'entrée", "Date d'embauche", "Embauché le", "Ancienneté depuis"
- La date est souvent en haut du bulletin, près des informations du salarié
- Convertis au format YYYY-MM-DD (ex: "01/09/2025" → "2025-09-01")

Comment identifier le statut cadre:
- Présence de cotisations AGIRC-ARRCO Tranche 2
- Présence cotisation APEC
- Présence prévoyance cadre (1.5% du PMSS)
- Mention explicite "Cadre" ou "Ingénieur" dans le poste

Comment calculer le taux de charges:
- employer_charges_rate = employer_charges_total / gross_salary_monthly

Si une information n'est pas trouvée, utilise null pour les valeurs optionnelles.`;

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
                text: "Analyse cette fiche de paie et extrais les données au format JSON."
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
          JSON.stringify({ error: "Crédits Lovable AI épuisés. Veuillez recharger votre compte." }),
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

    let payslipData: PayslipData;
    try {
      payslipData = JSON.parse(jsonString.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", jsonString);
      throw new Error("Impossible de parser la réponse. Vérifiez que le PDF est lisible.");
    }

    // Validate and sanitize the data
    const sanitizedData: PayslipData = {
      gross_salary_monthly: Number(payslipData.gross_salary_monthly) || 0,
      net_salary: payslipData.net_salary ? Number(payslipData.net_salary) : undefined,
      position: payslipData.position || undefined,
      is_executive: Boolean(payslipData.is_executive),
      contract_type: ['cdi', 'cdd', 'interim', 'apprentice'].includes(payslipData.contract_type) 
        ? payslipData.contract_type 
        : 'cdi',
      employer_charges_total: payslipData.employer_charges_total ? Number(payslipData.employer_charges_total) : undefined,
      employer_charges_rate: payslipData.employer_charges_rate ? Number(payslipData.employer_charges_rate) : undefined,
      mutuelle_employer: payslipData.mutuelle_employer ? Number(payslipData.mutuelle_employer) : undefined,
      at_mp_rate: payslipData.at_mp_rate ? Number(payslipData.at_mp_rate) : undefined,
      period: payslipData.period || undefined,
      employee_name: payslipData.employee_name || undefined,
      start_date: payslipData.start_date || undefined,
      confidence_score: Math.min(1, Math.max(0, Number(payslipData.confidence_score) || 0.5)),
    };

    // Calculate charges rate if we have both values but rate wasn't extracted
    if (sanitizedData.employer_charges_total && sanitizedData.gross_salary_monthly && !sanitizedData.employer_charges_rate) {
      sanitizedData.employer_charges_rate = sanitizedData.employer_charges_total / sanitizedData.gross_salary_monthly;
    }

    console.log("Extracted payslip data:", sanitizedData);

    return new Response(
      JSON.stringify(sanitizedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("parse-payslip error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erreur lors de l'analyse de la fiche de paie" 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
