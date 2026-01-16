import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PDFRequest {
  companyId: string;
  companyName: string;
  sections: string[];
  scenarioId?: string;
  introText?: string;
}

interface FinancialData {
  revenueStreams: any[];
  fixedExpenses: any[];
  variableExpenses: any[];
  personnel: any[];
  directors: any[];
  investments: any[];
  financings: any[];
  stocks: any[];
  settings: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyId, companyName, sections, scenarioId, introText }: PDFRequest = await req.json();
    
    console.log('Generating BP PDF for:', { companyId, companyName, sections: sections?.length });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all financial data
    const [
      { data: revenueStreams },
      { data: fixedExpenses },
      { data: variableExpenses },
      { data: personnel },
      { data: directors },
      { data: investments },
      { data: financings },
      { data: stocks },
      { data: settings }
    ] = await Promise.all([
      supabase.from('bp_revenue_streams').select('*').eq('company_id', companyId),
      supabase.from('bp_fixed_expenses').select('*').eq('company_id', companyId),
      supabase.from('bp_variable_expenses').select('*').eq('company_id', companyId),
      supabase.from('bp_personnel').select('*').eq('company_id', companyId),
      supabase.from('bp_directors').select('*').eq('company_id', companyId),
      supabase.from('bp_investments').select('*').eq('company_id', companyId),
      supabase.from('bp_financings').select('*').eq('company_id', companyId),
      supabase.from('bp_stocks').select('*').eq('company_id', companyId),
      supabase.from('bp_settings').select('*').eq('company_id', companyId).single()
    ]);

    const financialData: FinancialData = {
      revenueStreams: revenueStreams || [],
      fixedExpenses: fixedExpenses || [],
      variableExpenses: variableExpenses || [],
      personnel: personnel || [],
      directors: directors || [],
      investments: investments || [],
      financings: financings || [],
      stocks: stocks || [],
      settings: settings || {}
    };

    // Create PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPos = margin;

    // Helper functions
    const addNewPage = () => {
      doc.addPage();
      yPos = margin;
    };

    const checkPageBreak = (neededHeight: number) => {
      if (yPos + neededHeight > pageHeight - margin) {
        addNewPage();
      }
    };

    const formatCurrency = (value: number): string => {
      return new Intl.NumberFormat('fr-FR', { 
        style: 'currency', 
        currency: 'EUR', 
        maximumFractionDigits: 0 
      }).format(value);
    };

    const formatDate = (date: Date): string => {
      return date.toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    };

    // ========== COVER PAGE ==========
    if (sections?.includes('cover')) {
      // Background gradient effect (simple rectangle)
      doc.setFillColor(37, 99, 235); // Primary blue
      doc.rect(0, 0, pageWidth, 80, 'F');
      
      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(32);
      doc.setFont('helvetica', 'bold');
      doc.text('BUSINESS PLAN', pageWidth / 2, 40, { align: 'center' });
      
      // Company name
      doc.setFontSize(24);
      doc.setFont('helvetica', 'normal');
      doc.text(companyName || 'Entreprise', pageWidth / 2, 55, { align: 'center' });
      
      // Reset text color
      doc.setTextColor(51, 51, 51);
      
      // Intro text if provided
      if (introText) {
        yPos = 100;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(102, 102, 102);
        const introLines = doc.splitTextToSize(introText, pageWidth - margin * 2);
        doc.text(introLines, margin, yPos);
        yPos += introLines.length * 6 + 20;
      } else {
        yPos = 100;
      }
      
      // Date
      doc.setTextColor(136, 136, 136);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Généré le ${formatDate(new Date())}`, pageWidth / 2, pageHeight - 40, { align: 'center' });
      
      // Footer
      doc.setFontSize(10);
      doc.text('Document confidentiel', pageWidth / 2, pageHeight - 30, { align: 'center' });
      
      addNewPage();
    }

    // ========== EXECUTIVE SUMMARY ==========
    if (sections?.includes('executive_summary')) {
      doc.setTextColor(37, 99, 235);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Résumé Exécutif', margin, yPos);
      yPos += 15;
      
      doc.setTextColor(51, 51, 51);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      
      // Calculate key metrics
      const totalRevenue = financialData.revenueStreams.reduce((sum, rs) => {
        const monthlyPrice = rs.monthly_price || 0;
        const subscribers = rs.initial_subscribers || 0;
        return sum + (monthlyPrice * subscribers * 12);
      }, 0);
      
      const totalFixedExpenses = financialData.fixedExpenses.reduce((sum, e) => 
        sum + (e.monthly_amount || 0) * 12, 0);
      
      const totalPersonnelCosts = financialData.personnel.reduce((sum, p) => {
        const salary = p.gross_salary || 0;
        const charges = salary * (p.employer_charges_rate || 45) / 100;
        return sum + (salary + charges) * 12;
      }, 0);
      
      const totalInvestments = financialData.investments.reduce((sum, i) => 
        sum + (i.purchase_amount || 0), 0);
      
      const summaryText = [
        `Ce document présente les projections financières de ${companyName} sur les ${financialData.settings?.bp_years || 3} prochaines années.`,
        '',
        'Points clés du prévisionnel :',
        `• Chiffre d'affaires prévisionnel annuel : ${formatCurrency(totalRevenue)}`,
        `• Charges fixes annuelles : ${formatCurrency(totalFixedExpenses)}`,
        `• Masse salariale annuelle : ${formatCurrency(totalPersonnelCosts)}`,
        `• Investissements prévus : ${formatCurrency(totalInvestments)}`,
        `• Nombre de sources de revenus : ${financialData.revenueStreams.length}`,
        `• Effectif prévu : ${financialData.personnel.length} salarié(s)`,
      ];
      
      summaryText.forEach(line => {
        checkPageBreak(8);
        doc.text(line, margin, yPos);
        yPos += 7;
      });
      
      yPos += 10;
    }

    // ========== REVENUE SECTION ==========
    if (sections?.includes('revenue') && financialData.revenueStreams.length > 0) {
      checkPageBreak(40);
      
      doc.setTextColor(37, 99, 235);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Sources de Revenus', margin, yPos);
      yPos += 12;
      
      // Table header
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, yPos - 5, pageWidth - margin * 2, 8, 'F');
      doc.setTextColor(51, 51, 51);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Nom', margin + 2, yPos);
      doc.text('Modèle', margin + 60, yPos);
      doc.text('Prix/mois', margin + 100, yPos);
      doc.text('Abonnés', margin + 135, yPos);
      yPos += 8;
      
      doc.setFont('helvetica', 'normal');
      financialData.revenueStreams.forEach(rs => {
        checkPageBreak(8);
        doc.text(rs.name || '-', margin + 2, yPos);
        doc.text(rs.model || 'subscription', margin + 60, yPos);
        doc.text(formatCurrency(rs.monthly_price || 0), margin + 100, yPos);
        doc.text(String(rs.initial_subscribers || 0), margin + 135, yPos);
        yPos += 7;
      });
      
      yPos += 10;
    }

    // ========== PROFIT & LOSS ==========
    if (sections?.includes('pnl')) {
      checkPageBreak(60);
      
      doc.setTextColor(37, 99, 235);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Compte de Résultat Prévisionnel', margin, yPos);
      yPos += 12;
      
      const years = financialData.settings?.bp_years || 3;
      const startYear = new Date(financialData.settings?.bp_start_date || new Date()).getFullYear();
      
      // Calculate annual projections
      for (let year = 0; year < years; year++) {
        checkPageBreak(50);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(51, 51, 51);
        doc.text(`Année ${startYear + year}`, margin, yPos);
        yPos += 8;
        
        // Revenue
        const yearlyRevenue = financialData.revenueStreams.reduce((sum, rs) => {
          const monthlyPrice = rs.monthly_price || 0;
          const subscribers = rs.initial_subscribers || 0;
          const growthRate = rs.growth_rate || 0;
          const growthMultiplier = Math.pow(1 + growthRate / 100, year);
          return sum + (monthlyPrice * subscribers * 12 * growthMultiplier);
        }, 0);
        
        // Fixed expenses
        const yearlyFixedExpenses = financialData.fixedExpenses.reduce((sum, e) => 
          sum + (e.monthly_amount || 0) * 12, 0);
        
        // Personnel costs
        const yearlyPersonnelCosts = financialData.personnel.reduce((sum, p) => {
          const salary = p.gross_salary || 0;
          const charges = salary * (p.employer_charges_rate || 45) / 100;
          return sum + (salary + charges) * 12;
        }, 0);
        
        // Director costs
        const yearlyDirectorCosts = financialData.directors.reduce((sum, d) => {
          const remuneration = d.monthly_remuneration || 0;
          const charges = remuneration * (d.charges_rate || 45) / 100;
          return sum + (remuneration + charges) * 12;
        }, 0);
        
        // Depreciation
        const yearlyDepreciation = financialData.investments.reduce((sum, inv) => {
          const years = inv.depreciation_years || 5;
          return sum + (inv.purchase_amount || 0) / years;
        }, 0);
        
        const totalExpenses = yearlyFixedExpenses + yearlyPersonnelCosts + yearlyDirectorCosts + yearlyDepreciation;
        const operatingResult = yearlyRevenue - totalExpenses;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        const lines = [
          { label: 'Chiffre d\'affaires', value: yearlyRevenue, isPositive: true },
          { label: 'Charges fixes', value: -yearlyFixedExpenses, isPositive: false },
          { label: 'Masse salariale', value: -yearlyPersonnelCosts, isPositive: false },
          { label: 'Rémunération dirigeants', value: -yearlyDirectorCosts, isPositive: false },
          { label: 'Dotations aux amortissements', value: -yearlyDepreciation, isPositive: false },
        ];
        
        lines.forEach(line => {
          doc.text(line.label, margin + 5, yPos);
          if (line.isPositive) {
            doc.setTextColor(22, 163, 74);
          } else {
            doc.setTextColor(220, 38, 38);
          }
          doc.text(formatCurrency(Math.abs(line.value)), pageWidth - margin - 40, yPos, { align: 'right' });
          doc.setTextColor(51, 51, 51);
          yPos += 6;
        });
        
        // Operating result
        doc.setFont('helvetica', 'bold');
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
        yPos += 4;
        doc.text('Résultat d\'exploitation', margin + 5, yPos);
        if (operatingResult >= 0) {
          doc.setTextColor(22, 163, 74);
        } else {
          doc.setTextColor(220, 38, 38);
        }
        doc.text(formatCurrency(operatingResult), pageWidth - margin - 40, yPos, { align: 'right' });
        doc.setTextColor(51, 51, 51);
        yPos += 15;
      }
    }

    // ========== CASH FLOW ==========
    if (sections?.includes('cash_flow')) {
      checkPageBreak(40);
      
      doc.setTextColor(37, 99, 235);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Plan de Trésorerie', margin, yPos);
      yPos += 12;
      
      doc.setTextColor(51, 51, 51);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const initialCash = financialData.settings?.initial_cash || 0;
      const totalFinancings = financialData.financings.reduce((sum, f) => sum + (f.amount || 0), 0);
      
      const lines = [
        `• Trésorerie initiale : ${formatCurrency(initialCash)}`,
        `• Financements obtenus : ${formatCurrency(totalFinancings)}`,
        `• Délai de paiement clients : ${financialData.settings?.customer_payment_delay || 30} jours`,
        `• Délai de paiement fournisseurs : ${financialData.settings?.supplier_payment_delay || 30} jours`,
      ];
      
      lines.forEach(line => {
        doc.text(line, margin, yPos);
        yPos += 7;
      });
      
      yPos += 10;
    }

    // ========== BALANCE SHEET ==========
    if (sections?.includes('balance_sheet')) {
      checkPageBreak(40);
      
      doc.setTextColor(37, 99, 235);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Bilan Prévisionnel', margin, yPos);
      yPos += 12;
      
      doc.setTextColor(51, 51, 51);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const totalAssets = financialData.investments.reduce((sum, i) => sum + (i.purchase_amount || 0), 0);
      const totalStocks = financialData.stocks.reduce((sum, s) => sum + (s.initial_stock || 0), 0);
      const totalFinancings = financialData.financings.reduce((sum, f) => sum + (f.amount || 0), 0);
      
      const assetLines = [
        'ACTIF',
        `  Immobilisations : ${formatCurrency(totalAssets)}`,
        `  Stocks : ${formatCurrency(totalStocks)}`,
        '',
        'PASSIF',
        `  Emprunts et dettes : ${formatCurrency(totalFinancings)}`,
      ];
      
      assetLines.forEach(line => {
        doc.text(line, margin, yPos);
        yPos += 7;
      });
      
      yPos += 10;
    }

    // ========== FUNDING PLAN ==========
    if (sections?.includes('funding_plan')) {
      checkPageBreak(50);
      
      doc.setTextColor(37, 99, 235);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Plan de Financement', margin, yPos);
      yPos += 12;
      
      doc.setTextColor(51, 51, 51);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Besoins', margin, yPos);
      yPos += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      const totalInvestments = financialData.investments.reduce((sum, i) => sum + (i.purchase_amount || 0), 0);
      const totalStocks = financialData.stocks.reduce((sum, s) => sum + (s.initial_stock || 0), 0);
      const bfrInitial = totalStocks; // Simplified BFR
      
      doc.text(`  Investissements : ${formatCurrency(totalInvestments)}`, margin, yPos);
      yPos += 6;
      doc.text(`  BFR initial : ${formatCurrency(bfrInitial)}`, margin, yPos);
      yPos += 10;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Ressources', margin, yPos);
      yPos += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      const capitalContributions = financialData.financings
        .filter(f => f.financing_type === 'capital')
        .reduce((sum, f) => sum + (f.amount || 0), 0);
      const loans = financialData.financings
        .filter(f => f.financing_type === 'loan')
        .reduce((sum, f) => sum + (f.amount || 0), 0);
      
      doc.text(`  Apports en capital : ${formatCurrency(capitalContributions)}`, margin, yPos);
      yPos += 6;
      doc.text(`  Emprunts bancaires : ${formatCurrency(loans)}`, margin, yPos);
      yPos += 10;
      
      const totalNeeds = totalInvestments + bfrInitial;
      const totalResources = capitalContributions + loans;
      const balance = totalResources - totalNeeds;
      
      doc.setFont('helvetica', 'bold');
      doc.text(`Solde : ${formatCurrency(balance)}`, margin, yPos);
      doc.setTextColor(balance >= 0 ? 22 : 220, balance >= 0 ? 163 : 38, balance >= 0 ? 74 : 38);
      doc.text(balance >= 0 ? '(Équilibré)' : '(Besoin de financement)', margin + 80, yPos);
      
      yPos += 15;
    }

    // ========== INVESTMENTS ==========
    if (sections?.includes('investments') && financialData.investments.length > 0) {
      checkPageBreak(40);
      
      doc.setTextColor(37, 99, 235);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Investissements', margin, yPos);
      yPos += 12;
      
      // Table header
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, yPos - 5, pageWidth - margin * 2, 8, 'F');
      doc.setTextColor(51, 51, 51);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Désignation', margin + 2, yPos);
      doc.text('Montant', margin + 80, yPos);
      doc.text('Durée amort.', margin + 120, yPos);
      yPos += 8;
      
      doc.setFont('helvetica', 'normal');
      financialData.investments.forEach(inv => {
        checkPageBreak(8);
        doc.text(inv.name || '-', margin + 2, yPos);
        doc.text(formatCurrency(inv.purchase_amount || 0), margin + 80, yPos);
        doc.text(`${inv.depreciation_years || 5} ans`, margin + 120, yPos);
        yPos += 7;
      });
      
      yPos += 10;
    }

    // ========== FOOTER ON LAST PAGE ==========
    doc.setTextColor(136, 136, 136);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Document généré par qashflow - www.qashflow.com', pageWidth / 2, pageHeight - 15, { align: 'center' });
    doc.text('Les projections présentées sont indicatives et basées sur les hypothèses saisies.', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Generate PDF as base64
    const pdfBase64 = doc.output('datauristring');
    
    console.log('PDF generated successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        pdf: pdfBase64,
        filename: `business-plan-${companyName?.replace(/\s+/g, '-').toLowerCase() || 'export'}-${new Date().toISOString().split('T')[0]}.pdf`
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
