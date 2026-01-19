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
  primaryColor?: { r: number; g: number; b: number };
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
  scenarios: any[];
  bonuses: any[];
}

// Color palette - professional cabinet style
const COLORS = {
  primary: { r: 30, g: 64, b: 175 }, // Deep blue
  primaryLight: { r: 59, g: 130, b: 246 },
  secondary: { r: 100, g: 116, b: 139 },
  text: { r: 30, g: 41, b: 59 },
  textLight: { r: 100, g: 116, b: 139 },
  success: { r: 22, g: 163, b: 74 },
  danger: { r: 220, g: 38, b: 38 },
  tableHeader: { r: 241, g: 245, b: 249 },
  tableRowAlt: { r: 248, g: 250, b: 252 },
  border: { r: 226, g: 232, b: 240 },
  white: { r: 255, g: 255, b: 255 },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyId, companyName, sections, scenarioId, introText, primaryColor }: PDFRequest = await req.json();
    
    console.log('Generating Professional BP PDF for:', { companyId, companyName, sections: sections?.length });

    // Use custom primary color if provided
    if (primaryColor) {
      COLORS.primary = primaryColor;
    }

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
      { data: settings },
      { data: scenarios },
      { data: bonuses }
    ] = await Promise.all([
      supabase.from('bp_revenue_streams').select('*').eq('company_id', companyId).eq('is_active', true),
      supabase.from('bp_fixed_expenses').select('*').eq('company_id', companyId),
      supabase.from('bp_variable_expenses').select('*').eq('company_id', companyId),
      supabase.from('bp_personnel').select('*').eq('company_id', companyId),
      supabase.from('bp_directors').select('*').eq('company_id', companyId),
      supabase.from('bp_investments').select('*').eq('company_id', companyId),
      supabase.from('bp_financings').select('*').eq('company_id', companyId),
      supabase.from('bp_stocks').select('*').eq('company_id', companyId),
      supabase.from('bp_settings').select('*').eq('company_id', companyId).single(),
      supabase.from('bp_scenarios').select('*').eq('company_id', companyId),
      supabase.from('bp_bonuses').select('*')
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
      settings: settings || {},
      scenarios: scenarios || [],
      bonuses: bonuses || []
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
    const contentWidth = pageWidth - margin * 2;
    let yPos = margin;
    let currentPage = 1;
    let tocEntries: { title: string; page: number; level: number }[] = [];

    // ============ HELPER FUNCTIONS ============

    const setColor = (color: { r: number; g: number; b: number }) => {
      doc.setTextColor(color.r, color.g, color.b);
    };

    const setFillColor = (color: { r: number; g: number; b: number }) => {
      doc.setFillColor(color.r, color.g, color.b);
    };

    const setDrawColor = (color: { r: number; g: number; b: number }) => {
      doc.setDrawColor(color.r, color.g, color.b);
    };

    const addNewPage = () => {
      doc.addPage();
      currentPage++;
      yPos = margin + 15; // Leave space for header
      addHeaderFooter();
    };

    const checkPageBreak = (neededHeight: number) => {
      if (yPos + neededHeight > pageHeight - 25) { // 25mm for footer
        addNewPage();
        return true;
      }
      return false;
    };

    const formatCurrency = (value: number): string => {
      return new Intl.NumberFormat('fr-FR', { 
        style: 'currency', 
        currency: 'EUR', 
        maximumFractionDigits: 0 
      }).format(value);
    };

    const formatPercent = (value: number): string => {
      return new Intl.NumberFormat('fr-FR', { 
        style: 'percent', 
        minimumFractionDigits: 1,
        maximumFractionDigits: 1 
      }).format(value / 100);
    };

    const formatDate = (date: Date): string => {
      return date.toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    };

    const formatShortDate = (dateStr: string): string => {
      if (!dateStr) return '-';
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    };

    const addHeaderFooter = () => {
      // Header line
      setDrawColor(COLORS.border);
      doc.setLineWidth(0.3);
      doc.line(margin, 12, pageWidth - margin, 12);
      
      // Header text
      doc.setFontSize(8);
      setColor(COLORS.textLight);
      doc.setFont('helvetica', 'normal');
      doc.text(companyName || 'Business Plan', margin, 9);
      doc.text(formatDate(new Date()), pageWidth - margin, 9, { align: 'right' });

      // Footer
      doc.setFontSize(8);
      setColor(COLORS.textLight);
      doc.text(`Page ${currentPage}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.text('Document confidentiel', margin, pageHeight - 10);
      doc.text('qashflow.com', pageWidth - margin, pageHeight - 10, { align: 'right' });
    };

    const addSectionTitle = (title: string, level: number = 1) => {
      checkPageBreak(20);
      
      tocEntries.push({ title, page: currentPage, level });
      
      if (level === 1) {
        // Main section title with decorative line
        setFillColor(COLORS.primary);
        doc.rect(margin, yPos - 2, 4, 10, 'F');
        
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        setColor(COLORS.primary);
        doc.text(title, margin + 8, yPos + 5);
        yPos += 18;
      } else {
        // Subsection title
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        setColor(COLORS.text);
        doc.text(title, margin, yPos + 3);
        yPos += 12;
      }
    };

    // Professional table drawing
    const drawTable = (
      headers: string[],
      rows: (string | number)[][],
      columnWidths: number[],
      options: { 
        showTotal?: boolean; 
        totalLabel?: string; 
        totalValue?: string;
        alignRight?: number[];
      } = {}
    ) => {
      const rowHeight = 7;
      const headerHeight = 8;
      const tableWidth = columnWidths.reduce((a, b) => a + b, 0);
      
      // Check if table fits, otherwise start new page
      const tableHeight = headerHeight + rows.length * rowHeight + (options.showTotal ? rowHeight : 0);
      checkPageBreak(tableHeight + 10);

      // Header
      setFillColor(COLORS.primary);
      doc.rect(margin, yPos, tableWidth, headerHeight, 'F');
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      setColor(COLORS.white);
      
      let xPos = margin + 3;
      headers.forEach((header, i) => {
        const align = options.alignRight?.includes(i) ? 'right' : 'left';
        const textX = align === 'right' ? xPos + columnWidths[i] - 6 : xPos;
        doc.text(header, textX, yPos + 5.5, { align });
        xPos += columnWidths[i];
      });
      yPos += headerHeight;

      // Rows
      doc.setFont('helvetica', 'normal');
      setColor(COLORS.text);
      
      rows.forEach((row, rowIndex) => {
        // Alternating row colors
        if (rowIndex % 2 === 1) {
          setFillColor(COLORS.tableRowAlt);
          doc.rect(margin, yPos, tableWidth, rowHeight, 'F');
        }
        
        // Row border
        setDrawColor(COLORS.border);
        doc.setLineWidth(0.1);
        doc.line(margin, yPos + rowHeight, margin + tableWidth, yPos + rowHeight);
        
        xPos = margin + 3;
        doc.setFontSize(9);
        row.forEach((cell, i) => {
          const align = options.alignRight?.includes(i) ? 'right' : 'left';
          const textX = align === 'right' ? xPos + columnWidths[i] - 6 : xPos;
          const cellText = typeof cell === 'number' ? formatCurrency(cell) : String(cell || '-');
          // Truncate long text
          const maxWidth = columnWidths[i] - 6;
          let displayText = cellText;
          while (doc.getTextWidth(displayText) > maxWidth && displayText.length > 3) {
            displayText = displayText.slice(0, -4) + '...';
          }
          doc.text(displayText, textX, yPos + 5, { align });
          xPos += columnWidths[i];
        });
        yPos += rowHeight;
      });

      // Total row
      if (options.showTotal && options.totalLabel && options.totalValue) {
        setFillColor(COLORS.tableHeader);
        doc.rect(margin, yPos, tableWidth, rowHeight + 1, 'F');
        
        doc.setFont('helvetica', 'bold');
        setColor(COLORS.text);
        doc.setFontSize(9);
        doc.text(options.totalLabel, margin + 3, yPos + 5.5);
        doc.text(options.totalValue, margin + tableWidth - 6, yPos + 5.5, { align: 'right' });
        yPos += rowHeight + 1;
      }

      // Table border
      setDrawColor(COLORS.border);
      doc.setLineWidth(0.3);
      doc.rect(margin, yPos - tableHeight + headerHeight - rowHeight * rows.length - (options.showTotal ? rowHeight + 1 : 0), tableWidth, tableHeight);
      
      yPos += 8;
    };

    // ============ CALCULATIONS ============
    
    const startYear = new Date(financialData.settings?.bp_start_date || new Date()).getFullYear();
    const years = financialData.settings?.bp_years || 3;

    const calculateYearlyRevenue = (year: number) => {
      return financialData.revenueStreams.reduce((sum, rs) => {
        const monthlyPrice = rs.monthly_price || 0;
        const subscribers = rs.initial_subscribers || 0;
        let growthRate = rs.growth_rate || 0;
        if (year === 1 && rs.growth_rate_year2) growthRate = rs.growth_rate_year2;
        if (year === 2 && rs.growth_rate_year3) growthRate = rs.growth_rate_year3;
        if (year === 3 && rs.growth_rate_year4) growthRate = rs.growth_rate_year4;
        const growthMultiplier = Math.pow(1 + growthRate / 100, year);
        return sum + (monthlyPrice * subscribers * 12 * growthMultiplier);
      }, 0);
    };

    const calculateYearlyFixedExpenses = () => {
      return financialData.fixedExpenses.reduce((sum, e) => sum + (e.monthly_amount || 0) * 12, 0);
    };

    const calculateYearlyVariableExpenses = (revenue: number) => {
      return financialData.variableExpenses.reduce((sum, e) => {
        if (e.calculation_type === 'percentage') {
          return sum + revenue * (e.percentage || 0) / 100;
        }
        return sum + (e.unit_cost || 0) * 12;
      }, 0);
    };

    const calculateYearlyPersonnelCosts = () => {
      return financialData.personnel.reduce((sum, p) => {
        const salary = p.gross_salary || 0;
        const charges = salary * (p.employer_charges_rate || 45) / 100;
        const mutuelle = p.mutuelle_employer_amount || 0;
        return sum + (salary + charges + mutuelle) * 12;
      }, 0);
    };

    const calculateYearlyDirectorCosts = () => {
      return financialData.directors.reduce((sum, d) => {
        const remuneration = d.monthly_remuneration || 0;
        const charges = remuneration * (d.charges_rate || 45) / 100;
        return sum + (remuneration + charges) * 12;
      }, 0);
    };

    const calculateYearlyDepreciation = () => {
      return financialData.investments.reduce((sum, inv) => {
        const years = inv.depreciation_years || 5;
        return sum + (inv.purchase_amount || 0) / years;
      }, 0);
    };

    const calculateYearlyFinancialCharges = () => {
      return financialData.financings
        .filter(f => f.financing_type === 'loan')
        .reduce((sum, f) => {
          const interestRate = f.interest_rate || 0;
          return sum + (f.amount || 0) * interestRate / 100;
        }, 0);
    };

    const calculateIS = (result: number, isPME: boolean) => {
      if (result <= 0) return 0;
      if (isPME && result <= 42500) {
        return result * 0.15;
      }
      if (isPME) {
        return 42500 * 0.15 + (result - 42500) * 0.25;
      }
      return result * 0.25;
    };

    // ============ COVER PAGE ============
    
    if (sections?.includes('cover')) {
      // Elegant cover design
      // Top decorative band
      setFillColor(COLORS.primary);
      doc.rect(0, 0, pageWidth, 70, 'F');
      
      // Decorative geometric element
      doc.setGState({ opacity: 0.1 });
      doc.setFillColor(255, 255, 255);
      doc.circle(pageWidth - 40, 35, 60, 'F');
      doc.setGState({ opacity: 1 });
      
      // Title
      setColor(COLORS.white);
      doc.setFontSize(36);
      doc.setFont('helvetica', 'bold');
      doc.text('BUSINESS PLAN', margin, 38);
      
      // Subtitle
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('Prévisionnel Financier', margin, 52);
      
      // Company name box
      yPos = 90;
      setFillColor(COLORS.tableRowAlt);
      doc.roundedRect(margin, yPos, contentWidth, 30, 3, 3, 'F');
      
      setColor(COLORS.primary);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName || 'Entreprise', pageWidth / 2, yPos + 20, { align: 'center' });
      
      yPos = 135;
      
      // Period covered
      setColor(COLORS.text);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text(`Période : ${startYear} - ${startYear + years - 1}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;
      
      // Intro text
      if (introText) {
        yPos += 10;
        setColor(COLORS.textLight);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'italic');
        const introLines = doc.splitTextToSize(introText, contentWidth - 20);
        doc.text(introLines, margin + 10, yPos);
        yPos += introLines.length * 6 + 15;
      }
      
      // Bottom section with metadata
      yPos = pageHeight - 70;
      
      // Decorative line
      setDrawColor(COLORS.border);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 15;
      
      // Metadata in two columns
      setColor(COLORS.textLight);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      doc.text('Date de génération :', margin, yPos);
      setColor(COLORS.text);
      doc.text(formatDate(new Date()), margin + 45, yPos);
      
      setColor(COLORS.textLight);
      doc.text('Nombre d\'années :', pageWidth / 2, yPos);
      setColor(COLORS.text);
      doc.text(`${years} ans`, pageWidth / 2 + 45, yPos);
      
      yPos += 10;
      
      // Confidential notice
      setColor(COLORS.danger);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('DOCUMENT CONFIDENTIEL', pageWidth / 2, pageHeight - 25, { align: 'center' });
      
      setColor(COLORS.textLight);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Ce document contient des informations financières prévisionnelles et confidentielles.', pageWidth / 2, pageHeight - 18, { align: 'center' });
      
      addNewPage();
    }

    // ============ TABLE OF CONTENTS ============
    
    if (sections?.includes('cover') && sections.length > 1) {
      addSectionTitle('Sommaire', 1);
      yPos += 5;
      
      const tocItems = [
        { id: 'executive_summary', label: 'Résumé Exécutif' },
        { id: 'revenue', label: 'Hypothèses de Revenus' },
        { id: 'expenses', label: 'Charges Prévisionnelles' },
        { id: 'personnel', label: 'Charges de Personnel' },
        { id: 'investments', label: 'Investissements' },
        { id: 'pnl', label: 'Compte de Résultat' },
        { id: 'cash_flow', label: 'Plan de Trésorerie' },
        { id: 'balance_sheet', label: 'Bilan Prévisionnel' },
        { id: 'funding_plan', label: 'Plan de Financement' },
        { id: 'ratios', label: 'Indicateurs Financiers' },
        { id: 'notes', label: 'Notes et Hypothèses' },
      ];
      
      let tocNumber = 1;
      tocItems.forEach(item => {
        if (sections.includes(item.id)) {
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          setColor(COLORS.text);
          
          // Number
          setColor(COLORS.primary);
          doc.setFont('helvetica', 'bold');
          doc.text(`${tocNumber}.`, margin, yPos);
          
          // Title
          setColor(COLORS.text);
          doc.setFont('helvetica', 'normal');
          doc.text(item.label, margin + 10, yPos);
          
          // Dotted line
          setDrawColor(COLORS.border);
          doc.setLineDash([1, 1], 0);
          doc.line(margin + 65, yPos, pageWidth - margin - 20, yPos);
          doc.setLineDash([], 0);
          
          yPos += 10;
          tocNumber++;
        }
      });
      
      yPos += 10;
      addNewPage();
    }

    // ============ EXECUTIVE SUMMARY ============
    
    if (sections?.includes('executive_summary')) {
      addSectionTitle('Résumé Exécutif', 1);
      
      // Key metrics cards
      const revenue1 = calculateYearlyRevenue(0);
      const revenue3 = calculateYearlyRevenue(2);
      const fixedExp = calculateYearlyFixedExpenses();
      const personnelCost = calculateYearlyPersonnelCosts();
      const directorCost = calculateYearlyDirectorCosts();
      const totalInvestments = financialData.investments.reduce((s, i) => s + (i.purchase_amount || 0), 0);
      
      // Summary paragraph
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      setColor(COLORS.text);
      
      const summaryPara = `Ce document présente le prévisionnel financier de ${companyName || 'l\'entreprise'} sur ${years} années, de ${startYear} à ${startYear + years - 1}. Il détaille les hypothèses de revenus, la structure de coûts, les investissements prévus et les projections de rentabilité.`;
      const summaryLines = doc.splitTextToSize(summaryPara, contentWidth);
      doc.text(summaryLines, margin, yPos);
      yPos += summaryLines.length * 6 + 10;
      
      // Key figures box
      setFillColor(COLORS.tableRowAlt);
      doc.roundedRect(margin, yPos, contentWidth, 50, 2, 2, 'F');
      setDrawColor(COLORS.primary);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, contentWidth, 50, 2, 2, 'S');
      
      yPos += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      setColor(COLORS.primary);
      doc.text('CHIFFRES CLÉS', margin + 5, yPos);
      yPos += 8;
      
      const keyFigures = [
        { label: 'CA Année 1', value: formatCurrency(revenue1) },
        { label: `CA Année ${years}`, value: formatCurrency(revenue3) },
        { label: 'Charges fixes annuelles', value: formatCurrency(fixedExp) },
        { label: 'Masse salariale annuelle', value: formatCurrency(personnelCost) },
        { label: 'Rémunération dirigeants', value: formatCurrency(directorCost) },
        { label: 'Investissements totaux', value: formatCurrency(totalInvestments) },
      ];
      
      doc.setFont('helvetica', 'normal');
      setColor(COLORS.text);
      doc.setFontSize(9);
      
      keyFigures.forEach((fig, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = margin + 5 + col * (contentWidth / 2);
        const y = yPos + row * 10;
        
        doc.text(fig.label + ' :', x, y);
        doc.setFont('helvetica', 'bold');
        doc.text(fig.value, x + 55, y);
        doc.setFont('helvetica', 'normal');
      });
      
      yPos += 40;
      
      // Team summary
      yPos += 10;
      addSectionTitle('Équipe', 2);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      setColor(COLORS.text);
      
      const teamInfo = [
        `• ${financialData.personnel.length} salarié(s) prévu(s)`,
        `• ${financialData.directors.length} dirigeant(s)`,
        `• ${financialData.revenueStreams.length} source(s) de revenus identifiée(s)`,
        `• ${financialData.investments.length} investissement(s) planifié(s)`,
      ];
      
      teamInfo.forEach(line => {
        doc.text(line, margin, yPos);
        yPos += 7;
      });
      
      yPos += 10;
    }

    // ============ REVENUE SECTION ============
    
    if (sections?.includes('revenue') && financialData.revenueStreams.length > 0) {
      checkPageBreak(60);
      addSectionTitle('Hypothèses de Revenus', 1);
      
      // Revenue streams table
      const revenueHeaders = ['Flux de revenus', 'Modèle', 'Prix/mois', 'Vol. initial', 'Croissance'];
      const revenueRows = financialData.revenueStreams.map(rs => [
        rs.name || '-',
        rs.model === 'subscription' ? 'Abonnement' : rs.model === 'one_time' ? 'Ponctuel' : rs.model || '-',
        formatCurrency(rs.monthly_price || 0),
        String(rs.initial_subscribers || 0),
        `${rs.growth_rate || 0}%`
      ]);
      
      const totalMonthlyRevenue = financialData.revenueStreams.reduce((s, rs) => 
        s + (rs.monthly_price || 0) * (rs.initial_subscribers || 0), 0);
      
      drawTable(revenueHeaders, revenueRows, [55, 30, 30, 25, 30], {
        showTotal: true,
        totalLabel: 'Total CA mensuel initial',
        totalValue: formatCurrency(totalMonthlyRevenue),
        alignRight: [2, 3, 4]
      });
      
      // Revenue projection summary
      yPos += 5;
      addSectionTitle('Projection du Chiffre d\'Affaires', 2);
      
      const revProjHeaders = ['Année', 'Chiffre d\'affaires', 'Évolution'];
      const revProjRows: (string | number)[][] = [];
      
      for (let y = 0; y < years; y++) {
        const rev = calculateYearlyRevenue(y);
        const prevRev = y > 0 ? calculateYearlyRevenue(y - 1) : rev;
        const evolution = y > 0 ? ((rev - prevRev) / prevRev * 100).toFixed(1) + '%' : '-';
        revProjRows.push([`${startYear + y}`, formatCurrency(rev), evolution]);
      }
      
      drawTable(revProjHeaders, revProjRows, [50, 60, 60], { alignRight: [1, 2] });
    }

    // ============ EXPENSES SECTION ============
    
    if (sections?.includes('expenses')) {
      checkPageBreak(60);
      addSectionTitle('Charges Prévisionnelles', 1);
      
      // Fixed expenses
      if (financialData.fixedExpenses.length > 0) {
        addSectionTitle('Charges Fixes', 2);
        
        const fixedHeaders = ['Poste', 'Catégorie', 'Montant/mois', 'Montant annuel'];
        const fixedRows = financialData.fixedExpenses.map(e => [
          e.name || '-',
          e.category || '-',
          formatCurrency(e.monthly_amount || 0),
          formatCurrency((e.monthly_amount || 0) * 12)
        ]);
        
        const totalFixed = calculateYearlyFixedExpenses();
        
        drawTable(fixedHeaders, fixedRows, [50, 40, 40, 40], {
          showTotal: true,
          totalLabel: 'Total charges fixes annuelles',
          totalValue: formatCurrency(totalFixed),
          alignRight: [2, 3]
        });
      }
      
      // Variable expenses
      if (financialData.variableExpenses.length > 0) {
        checkPageBreak(40);
        addSectionTitle('Charges Variables', 2);
        
        const varHeaders = ['Poste', 'Type calcul', 'Valeur', 'Lié à'];
        const varRows = financialData.variableExpenses.map(e => [
          e.name || '-',
          e.calculation_type === 'percentage' ? '% du CA' : 'Coût unitaire',
          e.calculation_type === 'percentage' ? `${e.percentage || 0}%` : formatCurrency(e.unit_cost || 0),
          e.linked_revenue_stream_id ? 'Flux lié' : 'Global'
        ]);
        
        drawTable(varHeaders, varRows, [55, 35, 40, 40], { alignRight: [2] });
      }
    }

    // ============ PERSONNEL SECTION ============
    
    if (sections?.includes('personnel')) {
      checkPageBreak(60);
      addSectionTitle('Charges de Personnel', 1);
      
      // Personnel table
      if (financialData.personnel.length > 0) {
        addSectionTitle('Salariés', 2);
        
        const persHeaders = ['Poste', 'Date embauche', 'Brut mensuel', 'Charges', 'Coût total'];
        const persRows = financialData.personnel.map(p => {
          const salary = p.gross_salary || 0;
          const charges = salary * (p.employer_charges_rate || 45) / 100;
          const mutuelle = p.mutuelle_employer_amount || 0;
          return [
            p.position || '-',
            formatShortDate(p.start_date),
            formatCurrency(salary),
            `${p.employer_charges_rate || 45}%`,
            formatCurrency(salary + charges + mutuelle)
          ];
        });
        
        const totalPersonnel = calculateYearlyPersonnelCosts();
        
        drawTable(persHeaders, persRows, [50, 30, 30, 25, 35], {
          showTotal: true,
          totalLabel: 'Coût annuel total',
          totalValue: formatCurrency(totalPersonnel),
          alignRight: [2, 3, 4]
        });
      }
      
      // Directors
      if (financialData.directors.length > 0) {
        checkPageBreak(40);
        addSectionTitle('Dirigeants', 2);
        
        const dirHeaders = ['Nom', 'Statut', 'Rémunération', 'Charges', 'Coût total'];
        const dirRows = financialData.directors.map(d => {
          const remun = d.monthly_remuneration || 0;
          const charges = remun * (d.charges_rate || 45) / 100;
          return [
            d.name || '-',
            d.status || '-',
            formatCurrency(remun),
            `${d.charges_rate || 45}%`,
            formatCurrency(remun + charges)
          ];
        });
        
        const totalDirectors = calculateYearlyDirectorCosts();
        
        drawTable(dirHeaders, dirRows, [45, 35, 30, 25, 35], {
          showTotal: true,
          totalLabel: 'Coût annuel total',
          totalValue: formatCurrency(totalDirectors),
          alignRight: [2, 3, 4]
        });
      }
    }

    // ============ INVESTMENTS SECTION ============
    
    if (sections?.includes('investments') && financialData.investments.length > 0) {
      checkPageBreak(60);
      addSectionTitle('Investissements', 1);
      
      const invHeaders = ['Désignation', 'Catégorie', 'Date', 'Montant HT', 'Durée amort.', 'Dotation/an'];
      const invRows = financialData.investments.map(i => {
        const years = i.depreciation_years || 5;
        const dotation = (i.purchase_amount || 0) / years;
        return [
          i.name || '-',
          i.category || '-',
          formatShortDate(i.purchase_date),
          formatCurrency(i.purchase_amount || 0),
          `${years} ans`,
          formatCurrency(dotation)
        ];
      });
      
      const totalInv = financialData.investments.reduce((s, i) => s + (i.purchase_amount || 0), 0);
      const totalDotation = calculateYearlyDepreciation();
      
      drawTable(invHeaders, invRows, [40, 30, 25, 30, 22, 25], {
        showTotal: true,
        totalLabel: `Total : ${formatCurrency(totalInv)}`,
        totalValue: `Dotation : ${formatCurrency(totalDotation)}`,
        alignRight: [3, 5]
      });
    }

    // ============ PROFIT & LOSS ============
    
    if (sections?.includes('pnl')) {
      checkPageBreak(80);
      addSectionTitle('Compte de Résultat Prévisionnel', 1);
      
      // Multi-year P&L table
      const pnlHeaders = ['Rubrique', ...Array.from({ length: years }, (_, i) => `${startYear + i}`)];
      const pnlData: { label: string; values: number[]; isTotal?: boolean; isSubtotal?: boolean }[] = [];
      
      // Calculate all years
      const yearlyData = Array.from({ length: years }, (_, y) => {
        const revenue = calculateYearlyRevenue(y);
        const varExpenses = calculateYearlyVariableExpenses(revenue);
        const fixedExpenses = calculateYearlyFixedExpenses();
        const personnelCosts = calculateYearlyPersonnelCosts();
        const directorCosts = calculateYearlyDirectorCosts();
        const depreciation = calculateYearlyDepreciation();
        const financialCharges = calculateYearlyFinancialCharges();
        
        const grossMargin = revenue - varExpenses;
        const ebitda = grossMargin - fixedExpenses - personnelCosts - directorCosts;
        const operatingResult = ebitda - depreciation;
        const resultBeforeTax = operatingResult - financialCharges;
        const tax = calculateIS(resultBeforeTax, financialData.settings?.is_pme || true);
        const netResult = resultBeforeTax - tax;
        
        return {
          revenue,
          varExpenses,
          grossMargin,
          fixedExpenses,
          personnelCosts,
          directorCosts,
          ebitda,
          depreciation,
          operatingResult,
          financialCharges,
          resultBeforeTax,
          tax,
          netResult
        };
      });
      
      pnlData.push({ label: 'Chiffre d\'affaires', values: yearlyData.map(d => d.revenue) });
      pnlData.push({ label: '- Charges variables', values: yearlyData.map(d => -d.varExpenses) });
      pnlData.push({ label: 'Marge brute', values: yearlyData.map(d => d.grossMargin), isSubtotal: true });
      pnlData.push({ label: '- Charges fixes', values: yearlyData.map(d => -d.fixedExpenses) });
      pnlData.push({ label: '- Masse salariale', values: yearlyData.map(d => -d.personnelCosts) });
      pnlData.push({ label: '- Rémunération dirigeants', values: yearlyData.map(d => -d.directorCosts) });
      pnlData.push({ label: 'EBE (EBITDA)', values: yearlyData.map(d => d.ebitda), isSubtotal: true });
      pnlData.push({ label: '- Dotations amortissements', values: yearlyData.map(d => -d.depreciation) });
      pnlData.push({ label: 'Résultat d\'exploitation', values: yearlyData.map(d => d.operatingResult), isSubtotal: true });
      pnlData.push({ label: '- Charges financières', values: yearlyData.map(d => -d.financialCharges) });
      pnlData.push({ label: 'Résultat avant impôt', values: yearlyData.map(d => d.resultBeforeTax), isSubtotal: true });
      pnlData.push({ label: '- Impôt sur les sociétés', values: yearlyData.map(d => -d.tax) });
      pnlData.push({ label: 'RÉSULTAT NET', values: yearlyData.map(d => d.netResult), isTotal: true });
      
      // Draw P&L table manually for special formatting
      const colWidths = [70, ...Array(years).fill((contentWidth - 70) / years)];
      const rowHeight = 7;
      let tableY = yPos;
      
      // Header
      setFillColor(COLORS.primary);
      doc.rect(margin, tableY, contentWidth, 8, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      setColor(COLORS.white);
      doc.text(pnlHeaders[0], margin + 3, tableY + 5.5);
      pnlHeaders.slice(1).forEach((h, i) => {
        doc.text(h, margin + 70 + colWidths.slice(1, i + 1).reduce((a, b) => a + b, 0) + colWidths[i + 1] / 2, tableY + 5.5, { align: 'center' });
      });
      tableY += 8;
      
      // Rows
      pnlData.forEach((row, ri) => {
        checkPageBreak(rowHeight + 2);
        
        if (row.isTotal) {
          setFillColor(COLORS.primary);
          doc.rect(margin, tableY, contentWidth, rowHeight + 1, 'F');
          setColor(COLORS.white);
          doc.setFont('helvetica', 'bold');
        } else if (row.isSubtotal) {
          setFillColor(COLORS.tableHeader);
          doc.rect(margin, tableY, contentWidth, rowHeight, 'F');
          setColor(COLORS.text);
          doc.setFont('helvetica', 'bold');
        } else {
          if (ri % 2 === 1) {
            setFillColor(COLORS.tableRowAlt);
            doc.rect(margin, tableY, contentWidth, rowHeight, 'F');
          }
          setColor(COLORS.text);
          doc.setFont('helvetica', 'normal');
        }
        
        doc.setFontSize(9);
        doc.text(row.label, margin + 3, tableY + 5);
        
        row.values.forEach((v, vi) => {
          const colX = margin + 70 + colWidths.slice(1, vi + 1).reduce((a, b) => a + b, 0);
          const valueColor = v >= 0 ? (row.isTotal || row.isSubtotal ? COLORS.white : COLORS.success) : COLORS.danger;
          if (!row.isTotal) setColor(valueColor);
          doc.text(formatCurrency(Math.abs(v)), colX + colWidths[vi + 1] - 5, tableY + 5, { align: 'right' });
        });
        
        tableY += row.isTotal ? rowHeight + 1 : rowHeight;
      });
      
      yPos = tableY + 10;
    }

    // ============ CASH FLOW ============
    
    if (sections?.includes('cash_flow')) {
      checkPageBreak(60);
      addSectionTitle('Plan de Trésorerie', 1);
      
      // Settings summary
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      setColor(COLORS.text);
      
      const settings = financialData.settings;
      const cashInfo = [
        `• Trésorerie initiale : ${formatCurrency(settings?.initial_cash || 0)}`,
        `• Délai de paiement clients : ${settings?.customer_payment_delay || 30} jours`,
        `• Délai de paiement fournisseurs : ${settings?.supplier_payment_delay || 30} jours`,
      ];
      
      cashInfo.forEach(line => {
        doc.text(line, margin, yPos);
        yPos += 7;
      });
      yPos += 5;
      
      // Yearly cash flow summary
      addSectionTitle('Flux de Trésorerie Annuels', 2);
      
      const cfHeaders = ['Année', 'Encaissements', 'Décaissements', 'Flux net', 'Trésorerie fin'];
      const cfRows: string[][] = [];
      let cumulativeCash = settings?.initial_cash || 0;
      
      for (let y = 0; y < years; y++) {
        const revenue = calculateYearlyRevenue(y);
        const expenses = calculateYearlyFixedExpenses() + 
                        calculateYearlyVariableExpenses(revenue) + 
                        calculateYearlyPersonnelCosts() + 
                        calculateYearlyDirectorCosts() +
                        calculateYearlyFinancialCharges();
        const investments = y === 0 ? financialData.investments.reduce((s, i) => s + (i.purchase_amount || 0), 0) : 0;
        const financingIn = y === 0 ? financialData.financings.reduce((s, f) => s + (f.amount || 0), 0) : 0;
        const loanPayments = financialData.financings
          .filter(f => f.financing_type === 'loan')
          .reduce((s, f) => s + (f.monthly_payment || 0) * 12, 0);
        
        const inflows = revenue + financingIn;
        const outflows = expenses + investments + loanPayments;
        const netFlow = inflows - outflows;
        cumulativeCash += netFlow;
        
        cfRows.push([
          `${startYear + y}`,
          formatCurrency(inflows),
          formatCurrency(outflows),
          formatCurrency(netFlow),
          formatCurrency(cumulativeCash)
        ]);
      }
      
      drawTable(cfHeaders, cfRows, [30, 40, 40, 35, 40], { alignRight: [1, 2, 3, 4] });
    }

    // ============ BALANCE SHEET ============
    
    if (sections?.includes('balance_sheet')) {
      checkPageBreak(80);
      addSectionTitle('Bilan Prévisionnel', 1);
      
      const totalAssets = financialData.investments.reduce((s, i) => s + (i.purchase_amount || 0), 0);
      const totalStocks = financialData.stocks.reduce((s, st) => s + (st.initial_stock || 0), 0);
      const initialCash = financialData.settings?.initial_cash || 0;
      const totalFinancings = financialData.financings.reduce((s, f) => s + (f.amount || 0), 0);
      const loans = financialData.financings
        .filter(f => f.financing_type === 'loan')
        .reduce((s, f) => s + (f.amount || 0), 0);
      const capital = financialData.financings
        .filter(f => f.financing_type === 'capital' || f.financing_type === 'equity')
        .reduce((s, f) => s + (f.amount || 0), 0);
      
      // Simplified balance sheet
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      setColor(COLORS.primary);
      doc.text('ACTIF', margin, yPos);
      doc.text('PASSIF', pageWidth / 2 + 10, yPos);
      yPos += 8;
      
      setDrawColor(COLORS.border);
      doc.setLineWidth(0.3);
      doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
      
      const balanceItems = [
        { actif: 'Immobilisations', actifVal: totalAssets, passif: 'Capitaux propres', passifVal: capital },
        { actif: '- Amortissements', actifVal: -calculateYearlyDepreciation(), passif: 'Résultat exercice', passifVal: 0 },
        { actif: 'Stocks', actifVal: totalStocks, passif: 'Emprunts', passifVal: loans },
        { actif: 'Créances clients', actifVal: 0, passif: 'Dettes fournisseurs', passifVal: 0 },
        { actif: 'Disponibilités', actifVal: initialCash, passif: 'Autres dettes', passifVal: 0 },
      ];
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      setColor(COLORS.text);
      
      balanceItems.forEach(item => {
        doc.text(item.actif, margin, yPos);
        doc.text(formatCurrency(item.actifVal), margin + 70, yPos, { align: 'right' });
        
        doc.text(item.passif, pageWidth / 2 + 10, yPos);
        doc.text(formatCurrency(item.passifVal), pageWidth - margin, yPos, { align: 'right' });
        
        yPos += 7;
      });
      
      yPos += 5;
      setDrawColor(COLORS.primary);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 5;
      
      doc.setFont('helvetica', 'bold');
      const totalActif = totalAssets - calculateYearlyDepreciation() + totalStocks + initialCash;
      const totalPassif = capital + loans;
      doc.text('Total Actif', margin, yPos);
      doc.text(formatCurrency(totalActif), margin + 70, yPos, { align: 'right' });
      doc.text('Total Passif', pageWidth / 2 + 10, yPos);
      doc.text(formatCurrency(totalPassif), pageWidth - margin, yPos, { align: 'right' });
      
      yPos += 15;
    }

    // ============ FUNDING PLAN ============
    
    if (sections?.includes('funding_plan')) {
      checkPageBreak(80);
      addSectionTitle('Plan de Financement', 1);
      
      const totalInvestments = financialData.investments.reduce((s, i) => s + (i.purchase_amount || 0), 0);
      const totalStocks = financialData.stocks.reduce((s, st) => s + (st.initial_stock || 0), 0);
      const bfrInitial = totalStocks;
      
      const capital = financialData.financings
        .filter(f => f.financing_type === 'capital' || f.financing_type === 'equity')
        .reduce((s, f) => s + (f.amount || 0), 0);
      const cca = financialData.financings
        .filter(f => f.financing_type === 'cca')
        .reduce((s, f) => s + (f.amount || 0), 0);
      const loans = financialData.financings
        .filter(f => f.financing_type === 'loan')
        .reduce((s, f) => s + (f.amount || 0), 0);
      const grants = financialData.financings
        .filter(f => f.financing_type === 'grant')
        .reduce((s, f) => s + (f.amount || 0), 0);
      
      const totalNeeds = totalInvestments + bfrInitial;
      const totalResources = capital + cca + loans + grants;
      const balance = totalResources - totalNeeds;
      
      // Two-column layout
      const colWidth = (contentWidth - 10) / 2;
      
      // Needs column
      setFillColor(COLORS.tableHeader);
      doc.rect(margin, yPos, colWidth, 10, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      setColor(COLORS.primary);
      doc.text('EMPLOIS (Besoins)', margin + 5, yPos + 7);
      
      // Resources column
      doc.rect(margin + colWidth + 10, yPos, colWidth, 10, 'F');
      doc.text('RESSOURCES', margin + colWidth + 15, yPos + 7);
      yPos += 12;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      setColor(COLORS.text);
      
      const needsItems = [
        { label: 'Investissements', value: totalInvestments },
        { label: 'BFR initial', value: bfrInitial },
        { label: 'Frais d\'établissement', value: 0 },
      ];
      
      const resourceItems = [
        { label: 'Capital social', value: capital },
        { label: 'Comptes courants', value: cca },
        { label: 'Emprunts bancaires', value: loans },
        { label: 'Subventions', value: grants },
      ];
      
      const maxRows = Math.max(needsItems.length, resourceItems.length);
      
      for (let i = 0; i < maxRows; i++) {
        if (needsItems[i]) {
          doc.text(needsItems[i].label, margin + 5, yPos);
          doc.text(formatCurrency(needsItems[i].value), margin + colWidth - 5, yPos, { align: 'right' });
        }
        if (resourceItems[i]) {
          doc.text(resourceItems[i].label, margin + colWidth + 15, yPos);
          doc.text(formatCurrency(resourceItems[i].value), margin + contentWidth - 5, yPos, { align: 'right' });
        }
        yPos += 7;
      }
      
      yPos += 5;
      setDrawColor(COLORS.primary);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, margin + colWidth, yPos);
      doc.line(margin + colWidth + 10, yPos, margin + contentWidth, yPos);
      yPos += 6;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Total Emplois', margin + 5, yPos);
      doc.text(formatCurrency(totalNeeds), margin + colWidth - 5, yPos, { align: 'right' });
      doc.text('Total Ressources', margin + colWidth + 15, yPos);
      doc.text(formatCurrency(totalResources), margin + contentWidth - 5, yPos, { align: 'right' });
      
      yPos += 15;
      
      // Balance box
      const balanceColor = balance >= 0 ? COLORS.success : COLORS.danger;
      setFillColor(balanceColor);
      doc.roundedRect(margin, yPos, contentWidth, 15, 2, 2, 'F');
      setColor(COLORS.white);
      doc.setFontSize(12);
      doc.text(
        balance >= 0 ? `Solde positif : ${formatCurrency(balance)}` : `Besoin de financement : ${formatCurrency(Math.abs(balance))}`,
        pageWidth / 2,
        yPos + 10,
        { align: 'center' }
      );
      
      yPos += 25;
    }

    // ============ RATIOS SECTION ============
    
    if (sections?.includes('ratios')) {
      checkPageBreak(80);
      addSectionTitle('Indicateurs Financiers', 1);
      
      const revenue1 = calculateYearlyRevenue(0);
      const varExp1 = calculateYearlyVariableExpenses(revenue1);
      const fixedExp = calculateYearlyFixedExpenses();
      const personnelCost = calculateYearlyPersonnelCosts();
      const directorCost = calculateYearlyDirectorCosts();
      const depreciation = calculateYearlyDepreciation();
      
      const grossMargin = revenue1 - varExp1;
      const grossMarginRate = revenue1 > 0 ? (grossMargin / revenue1) * 100 : 0;
      
      const totalFixedCosts = fixedExp + personnelCost + directorCost;
      const contributionMarginRate = grossMarginRate / 100;
      const breakEvenRevenue = contributionMarginRate > 0 ? totalFixedCosts / contributionMarginRate : 0;
      
      const ebitda = grossMargin - totalFixedCosts;
      const operatingResult = ebitda - depreciation;
      const netMarginRate = revenue1 > 0 ? (operatingResult / revenue1) * 100 : 0;
      
      const caf = operatingResult + depreciation;
      
      // Ratios table
      const ratiosHeaders = ['Indicateur', 'Année 1', 'Interprétation'];
      const ratiosRows = [
        ['Taux de marge brute', formatPercent(grossMarginRate), grossMarginRate > 50 ? 'Excellent' : grossMarginRate > 30 ? 'Bon' : 'À améliorer'],
        ['Taux de marge nette', formatPercent(netMarginRate), netMarginRate > 15 ? 'Excellent' : netMarginRate > 5 ? 'Correct' : netMarginRate > 0 ? 'Faible' : 'Déficitaire'],
        ['Point mort (CA)', formatCurrency(breakEvenRevenue), breakEvenRevenue < revenue1 ? 'Atteint' : 'Non atteint'],
        ['Mois pour atteindre PM', String(Math.ceil(breakEvenRevenue / (revenue1 / 12))), breakEvenRevenue < revenue1 ? 'OK' : 'Vigilance'],
        ['EBITDA', formatCurrency(ebitda), ebitda > 0 ? 'Positif' : 'Négatif'],
        ['CAF (Capacité d\'autofinancement)', formatCurrency(caf), caf > 0 ? 'Bonne capacité' : 'Insuffisante'],
      ];
      
      drawTable(ratiosHeaders, ratiosRows, [70, 50, 50], { alignRight: [1] });
      
      // Key insight box
      yPos += 5;
      setFillColor(COLORS.tableRowAlt);
      doc.roundedRect(margin, yPos, contentWidth, 25, 2, 2, 'F');
      setDrawColor(COLORS.primary);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, contentWidth, 25, 2, 2, 'S');
      
      setColor(COLORS.primary);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('💡 Point clé', margin + 5, yPos + 8);
      
      setColor(COLORS.text);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      const insight = breakEvenRevenue < revenue1 
        ? `Le point mort est atteint au mois ${Math.ceil(breakEvenRevenue / (revenue1 / 12))} de l'année 1. L'activité devient rentable rapidement.`
        : `Le point mort de ${formatCurrency(breakEvenRevenue)} dépasse le CA prévisionnel. Une révision des hypothèses est recommandée.`;
      
      const insightLines = doc.splitTextToSize(insight, contentWidth - 10);
      doc.text(insightLines, margin + 5, yPos + 16);
      
      yPos += 35;
    }

    // ============ NOTES SECTION ============
    
    if (sections?.includes('notes')) {
      checkPageBreak(60);
      addSectionTitle('Notes et Hypothèses', 1);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      setColor(COLORS.text);
      
      const hypotheses = [
        `Période de projection : ${years} années (${startYear} - ${startYear + years - 1})`,
        `Régime fiscal : ${financialData.settings?.tax_regime === 'IS' ? 'Impôt sur les Sociétés' : 'Impôt sur le Revenu'}`,
        `Statut PME : ${financialData.settings?.is_pme ? 'Oui (taux réduit IS 15% jusqu\'à 42 500€)' : 'Non'}`,
        `Délai de paiement clients : ${financialData.settings?.customer_payment_delay || 30} jours`,
        `Délai de paiement fournisseurs : ${financialData.settings?.supplier_payment_delay || 30} jours`,
        `Trésorerie initiale : ${formatCurrency(financialData.settings?.initial_cash || 0)}`,
        `Taux de charges patronales moyen : 45%`,
      ];
      
      hypotheses.forEach(h => {
        doc.text(`• ${h}`, margin, yPos);
        yPos += 7;
      });
      
      yPos += 10;
      
      // Disclaimer
      setFillColor(COLORS.tableRowAlt);
      doc.rect(margin, yPos, contentWidth, 25, 'F');
      
      setColor(COLORS.textLight);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      
      const disclaimer = 'Les projections présentées dans ce document sont indicatives et basées sur les hypothèses saisies. Elles ne constituent pas un engagement et doivent être régulièrement mises à jour en fonction de l\'évolution réelle de l\'activité.';
      const disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth - 10);
      doc.text(disclaimerLines, margin + 5, yPos + 8);
      
      yPos += 35;
    }

    // ============ FINAL FOOTER ============
    
    doc.setFontSize(8);
    setColor(COLORS.textLight);
    doc.setFont('helvetica', 'normal');
    doc.text('Document généré par qashflow - www.qashflow.com', pageWidth / 2, pageHeight - 8, { align: 'center' });

    // Generate PDF as base64
    const pdfBase64 = doc.output('datauristring');
    
    console.log('Professional PDF generated successfully -', currentPage, 'pages');

    return new Response(
      JSON.stringify({ 
        success: true,
        pdf: pdfBase64,
        filename: `business-plan-${companyName?.replace(/\s+/g, '-').toLowerCase() || 'export'}-${new Date().toISOString().split('T')[0]}.pdf`,
        pages: currentPage
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
