import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyId, companyName, sections, scenarioId, introText } = await req.json();
    
    console.log('Generating BP PDF for:', { companyId, companyName, sections: sections?.length });

    // For now, return a simple HTML that can be converted to PDF
    // In production, you would use a proper PDF library
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Business Plan - ${companyName}</title>
        <style>
          body { font-family: 'Helvetica', Arial, sans-serif; margin: 40px; color: #333; }
          .cover { text-align: center; padding: 100px 0; page-break-after: always; }
          .cover h1 { font-size: 36px; margin-bottom: 20px; color: #1a1a1a; }
          .cover h2 { font-size: 24px; color: #666; font-weight: normal; }
          .cover .date { margin-top: 60px; color: #888; }
          .section { page-break-before: always; padding: 20px 0; }
          .section h2 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
          th { background: #f5f5f5; text-align: left; }
          .positive { color: #16a34a; }
          .negative { color: #dc2626; }
          .intro { font-style: italic; color: #666; margin: 20px 0; padding: 20px; background: #f9f9f9; border-radius: 8px; }
        </style>
      </head>
      <body>
        ${sections?.includes('cover') ? `
        <div class="cover">
          <h1>BUSINESS PLAN</h1>
          <h2>${companyName}</h2>
          ${introText ? `<p class="intro">${introText}</p>` : ''}
          <p class="date">Généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        ` : ''}
        
        ${sections?.includes('executive_summary') ? `
        <div class="section">
          <h2>Résumé Exécutif</h2>
          <p>Ce document présente les projections financières de ${companyName} sur les prochaines années.</p>
          <p>Les données présentées sont basées sur les hypothèses saisies dans l'application qashflow.</p>
        </div>
        ` : ''}

        ${sections?.includes('pnl') ? `
        <div class="section">
          <h2>Compte de Résultat Prévisionnel</h2>
          <p>Le compte de résultat détaillé est disponible dans l'application.</p>
          <p><em>Note: Pour une version complète avec données, connectez-vous à l'application.</em></p>
        </div>
        ` : ''}

        ${sections?.includes('cash_flow') ? `
        <div class="section">
          <h2>Plan de Trésorerie</h2>
          <p>Le plan de trésorerie mensuel est disponible dans l'application.</p>
        </div>
        ` : ''}

        ${sections?.includes('balance_sheet') ? `
        <div class="section">
          <h2>Bilan Prévisionnel</h2>
          <p>Le bilan prévisionnel annuel est disponible dans l'application.</p>
        </div>
        ` : ''}

        ${sections?.includes('funding_plan') ? `
        <div class="section">
          <h2>Plan de Financement</h2>
          <p>Le tableau des besoins et ressources est disponible dans l'application.</p>
        </div>
        ` : ''}

        <div class="section" style="text-align: center; color: #888; font-size: 12px;">
          <p>Document généré par qashflow - www.qashflow.com</p>
          <p>Les projections présentées sont indicatives et basées sur les hypothèses saisies.</p>
        </div>
      </body>
      </html>
    `;

    // Return HTML for now - in production, convert to PDF using a service
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Export PDF en cours de développement. Version HTML disponible.',
        htmlContent: html,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
