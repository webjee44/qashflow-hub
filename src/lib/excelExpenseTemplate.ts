// ============================================
// Excel Template Generator for Fixed Expenses
// Generates .xlsx with native dropdown validations
// ============================================

import ExcelJS from 'exceljs';
import { 
  FIXED_EXPENSE_CATEGORIES, 
  PAYMENT_FREQUENCIES,
  type FixedExpenseCategory,
  type PaymentFrequency 
} from '@/constants/bpConstants';
import type { BPFixedExpense } from '@/hooks/useBPFixedExpenses';
import { format } from 'date-fns';

// Get category label from key
export function getCategoryLabel(key: FixedExpenseCategory): string {
  return FIXED_EXPENSE_CATEGORIES[key]?.label || key;
}

// Get frequency label from key
export function getFrequencyLabel(key: PaymentFrequency): string {
  return PAYMENT_FREQUENCIES[key]?.label || 'Mensuel';
}

// Reverse lookup: label -> key for categories
export function labelToCategory(label: string): FixedExpenseCategory {
  const entry = Object.entries(FIXED_EXPENSE_CATEGORIES).find(
    ([, { label: l }]) => l.toLowerCase() === label?.toLowerCase()
  );
  return (entry?.[0] as FixedExpenseCategory) || 'other';
}

// Reverse lookup: label -> key for frequencies
export function labelToFrequency(label: string): PaymentFrequency {
  const entry = Object.entries(PAYMENT_FREQUENCIES).find(
    ([, { label: l }]) => l.toLowerCase() === label?.toLowerCase()
  );
  return (entry?.[0] as PaymentFrequency) || 'monthly';
}

export async function generateExpenseTemplate(existingExpenses: BPFixedExpense[]): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Lovable Business Plan';
  workbook.created = new Date();
  
  // Main worksheet
  const sheet = workbook.addWorksheet('Charges fixes');
  
  // Hidden worksheet for dropdown lists
  const listsSheet = workbook.addWorksheet('Listes');
  listsSheet.state = 'veryHidden'; // Invisible to user
  
  // Populate dropdown lists
  const categories = Object.entries(FIXED_EXPENSE_CATEGORIES).map(([, { label }]) => label);
  const frequencies = Object.entries(PAYMENT_FREQUENCIES).map(([, { label }]) => label);
  const yesNo = ['Oui', 'Non'];
  
  categories.forEach((cat, i) => {
    listsSheet.getCell(`A${i + 1}`).value = cat;
  });
  frequencies.forEach((freq, i) => {
    listsSheet.getCell(`B${i + 1}`).value = freq;
  });
  yesNo.forEach((val, i) => {
    listsSheet.getCell(`C${i + 1}`).value = val;
  });
  
  // Define named ranges for dropdowns
  workbook.definedNames.add(`Listes!$A$1:$A$${categories.length}`, 'Categories');
  workbook.definedNames.add(`Listes!$B$1:$B$${frequencies.length}`, 'Periodicites');
  workbook.definedNames.add(`Listes!$C$1:$C$2`, 'OuiNon');
  
  // Set up columns
  sheet.columns = [
    { header: 'ID (ne pas modifier)', key: 'id', width: 38 },
    { header: 'Nom *', key: 'name', width: 35 },
    { header: 'Catégorie *', key: 'category', width: 28 },
    { header: 'Montant (€) *', key: 'amount', width: 15 },
    { header: 'Périodicité', key: 'frequency', width: 15 },
    { header: 'Taux TVA (%)', key: 'vat', width: 14 },
    { header: 'TVA déductible', key: 'vatDeductible', width: 16 },
    { header: 'Date début', key: 'startDate', width: 14 },
    { header: 'Date fin', key: 'endDate', width: 14 },
    { header: 'Notes', key: 'notes', width: 40 },
  ];
  
  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FF1E293B' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;
  
  // Add existing expenses
  existingExpenses.forEach((expense) => {
    sheet.addRow({
      id: expense.id,
      name: expense.name,
      category: getCategoryLabel(expense.category as FixedExpenseCategory),
      amount: expense.monthly_amount,
      frequency: getFrequencyLabel(expense.payment_frequency as PaymentFrequency),
      vat: (expense.vat_rate || 0.20) * 100,
      vatDeductible: expense.is_vat_deductible ? 'Oui' : 'Non',
      startDate: expense.start_date || '',
      endDate: expense.end_date || '',
      notes: expense.notes || '',
    });
  });
  
  // Add 50 empty rows for new entries
  const startEmptyRow = existingExpenses.length + 2;
  for (let i = 0; i < 50; i++) {
    sheet.addRow({});
  }
  
  const lastDataRow = startEmptyRow + 49;
  
  // Apply data validations (dropdowns) using getColumn approach
  // Category dropdown (column C)
  for (let row = 2; row <= lastDataRow; row++) {
    const cell = sheet.getCell(`C${row}`);
    cell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['=Categories'],
      showErrorMessage: true,
      errorTitle: 'Catégorie invalide',
      error: 'Veuillez sélectionner une catégorie dans la liste',
      showInputMessage: true,
      promptTitle: 'Catégorie',
      prompt: 'Sélectionnez une catégorie',
    };
  }
  
  // Frequency dropdown (column E)
  for (let row = 2; row <= lastDataRow; row++) {
    const cell = sheet.getCell(`E${row}`);
    cell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['=Periodicites'],
      showErrorMessage: true,
      errorTitle: 'Périodicité invalide',
      error: 'Veuillez sélectionner une périodicité dans la liste',
      showInputMessage: true,
      promptTitle: 'Périodicité',
      prompt: 'Mensuel, Trimestriel, Semestriel ou Annuel',
    };
  }
  
  // VAT deductible dropdown (column G)
  for (let row = 2; row <= lastDataRow; row++) {
    const cell = sheet.getCell(`G${row}`);
    cell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['=OuiNon'],
      showErrorMessage: true,
      errorTitle: 'Valeur invalide',
      error: 'Veuillez sélectionner Oui ou Non',
    };
  }
  
  // Style ID column as read-only appearance (grey background)
  for (let row = 2; row <= existingExpenses.length + 1; row++) {
    const cell = sheet.getCell(`A${row}`);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    cell.font = { color: { argb: 'FF94A3B8' }, size: 9 };
  }
  
  // Add instructions row at the bottom
  const instructionRow = sheet.addRow([]);
  instructionRow.height = 10;
  
  const instructionsStartRow = lastDataRow + 2;
  sheet.mergeCells(`A${instructionsStartRow}:J${instructionsStartRow}`);
  const instructionCell = sheet.getCell(`A${instructionsStartRow}`);
  instructionCell.value = '📋 Instructions: • Remplissez les lignes vides pour ajouter des charges • Modifiez les lignes existantes pour les mettre à jour • Videz le nom d\'une ligne avec ID pour la supprimer';
  instructionCell.font = { italic: true, color: { argb: 'FF64748B' }, size: 10 };
  instructionCell.alignment = { wrapText: true };
  
  return workbook;
}

export async function downloadExpenseTemplate(expenses: BPFixedExpense[]): Promise<void> {
  const workbook = await generateExpenseTemplate(expenses);
  const buffer = await workbook.xlsx.writeBuffer();
  
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `charges-fixes-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
