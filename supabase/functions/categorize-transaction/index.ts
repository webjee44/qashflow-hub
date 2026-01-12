import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { transactionIds, companyId } = await req.json();
    
    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return new Response(JSON.stringify({ error: 'transactionIds requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "Service IA non configuré" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch transactions to categorize
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('id, description, amount, type')
      .in('id', transactionIds)
      .is('category_id', null);

    if (txError) {
      console.error('Error fetching transactions:', txError);
      throw txError;
    }

    if (!transactions || transactions.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        categorized: 0,
        message: 'Aucune transaction à catégoriser' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch available categories
    let categoriesQuery = supabase.from('categories').select('id, name, type');
    if (companyId) {
      categoriesQuery = categoriesQuery.or(`company_id.eq.${companyId},company_id.is.null`);
    }

    const { data: categories, error: catError } = await categoriesQuery;

    if (catError) {
      console.error('Error fetching categories:', catError);
      throw catError;
    }

    if (!categories || categories.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        categorized: 0,
        message: 'Aucune catégorie disponible' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch recent categorized transactions for context
    let recentQuery = supabase
      .from('transactions')
      .select('description, category_id, categories(name)')
      .not('category_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (companyId) {
      recentQuery = recentQuery.eq('company_id', companyId);
    }

    const { data: recentTransactions } = await recentQuery;

    // Build context from recent categorizations
    const examples = recentTransactions?.map((t: any) => 
      `"${t.description}" → ${t.categories?.name}`
    ).slice(0, 20).join('\n') || '';

    // Prepare categories list
    const incomeCategories = categories.filter(c => c.type === 'income').map(c => c.name).join(', ');
    const expenseCategories = categories.filter(c => c.type === 'expense').map(c => c.name).join(', ');

    // Prepare transactions for AI
    const transactionsText = transactions.map((t: Transaction) => 
      `ID: ${t.id} | Type: ${t.type} | Montant: ${t.amount}€ | Description: "${t.description}"`
    ).join('\n');

    const systemPrompt = `Tu es un assistant de catégorisation de transactions bancaires pour une entreprise française.

CATÉGORIES DISPONIBLES:
- Encaissements (income): ${incomeCategories || 'Aucune'}
- Décaissements (expense): ${expenseCategories || 'Aucune'}

${examples ? `EXEMPLES DE CATÉGORISATIONS PASSÉES:\n${examples}\n` : ''}

RÈGLES:
1. Utilise UNIQUEMENT les catégories listées ci-dessus
2. Une transaction de type "income" DOIT être catégorisée avec une catégorie d'encaissement
3. Une transaction de type "expense" DOIT être catégorisée avec une catégorie de décaissement
4. Analyse le libellé pour déterminer la meilleure catégorie
5. Si tu n'es pas sûr, utilise la catégorie la plus générique appropriée`;

    const userPrompt = `Catégorise ces transactions:

${transactionsText}

Réponds UNIQUEMENT au format JSON suivant, sans aucun texte avant ou après:
[{"id": "uuid", "category": "nom exact de la catégorie", "confidence": 0.0-1.0}]`;

    // Call AI Gateway
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
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez plus tard" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Erreur du service IA");
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Réponse IA vide");
    }

    // Parse AI response
    let suggestions: Array<{ id: string; category: string; confidence: number }>;
    try {
      // Clean the response (remove markdown code blocks if present)
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      suggestions = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Error parsing AI response:', content);
      throw new Error("Format de réponse IA invalide");
    }

    // Map suggestions to category IDs and update transactions
    let categorizedCount = 0;
    const results: Array<{ id: string; category: string; confidence: number }> = [];

    for (const suggestion of suggestions) {
      const category = categories.find(c => 
        c.name.toLowerCase() === suggestion.category.toLowerCase()
      );

      if (category) {
        const { error: updateError } = await supabase
          .from('transactions')
          .update({ 
            category_id: category.id,
            ai_confidence: suggestion.confidence
          })
          .eq('id', suggestion.id);

        if (!updateError) {
          categorizedCount++;
          results.push({
            id: suggestion.id,
            category: category.name,
            confidence: suggestion.confidence
          });
        } else {
          console.error('Error updating transaction:', suggestion.id, updateError);
        }
      } else {
        console.warn('Category not found:', suggestion.category);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      categorized: categorizedCount,
      total: transactions.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Categorization error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erreur inconnue" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
