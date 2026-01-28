// ============================================
// Excel Parser for Fixed Expenses Import
// Detects creations, updates, and deletions
// ============================================

import ExcelJS from 'exceljs';
import { 
  labelToCategory, 
  labelToFrequency 
} from './excelExpenseTemplate';
import type { BPFixedExpense } from '@/hooks/useBPFixedExpenses';
import type { FixedExpenseCategory, PaymentFrequency } from '@/constants/bpConstants';
import { format, parse, isValid } from 'date-fns';

export interface ExpenseImportRow {
  id?: string;
  name: string;
  category: FixedExpenseCategory;
  monthly_amount: number;
  payment_frequency: PaymentFrequency;
  vat_rate: number;
  is_vat_deductible: boolean;
  start_date: string;
  end_date: string | null;
  notes: string | null;
}

export interface ImportDiff {
  toCreate: ExpenseImportRow[];
  toUpdate: { id: string; changes: Partial<ExpenseImportRow> }[];
  toDelete: string[];
  errors: { row: number; message: string }[];
  unchanged: number;
}

function parseDate(value: unknown): string | null {
  if (!value) return null;
  
  // If it's already a Date object
  if (value instanceof Date) {
    return isValid(value) ? format(value, 'yyyy-MM-dd') : null;
  }
  
  const strValue = String(value).trim();
  if (!strValue) return null;
  
  // Try parsing various formats
  const formats = ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'd/M/yyyy'];
  for (const fmt of formats) {
    try {
      const parsed = parse(strValue, fmt, new Date());
      if (isValid(parsed)) {
        return format(parsed, 'yyyy-MM-dd');
      }
    } catch {
      // Continue to next format
    }
  }
  
  return null;
}

function getCellValue(cell: ExcelJS.Cell): unknown {
  if (cell.value === null || cell.value === undefined) return null;
  
  // Handle rich text
  if (typeof cell.value === 'object' && 'richText' in cell.value) {
    return (cell.value as { richText: { text: string }[] }).richText
      .map((rt) => rt.text)
      .join('');
  }
  
  // Handle formula results
  if (typeof cell.value === 'object' && 'result' in cell.value) {
    return (cell.value as { result: unknown }).result;
  }
  
  return cell.value;
}

function hasChanges(existing: BPFixedExpense, imported: ExpenseImportRow): boolean {
  return (
    existing.name !== imported.name ||
    existing.category !== imported.category ||
    existing.monthly_amount !== imported.monthly_amount ||
    existing.payment_frequency !== imported.payment_frequency ||
    Math.abs((existing.vat_rate || 0.20) - imported.vat_rate) > 0.001 ||
    existing.is_vat_deductible !== imported.is_vat_deductible ||
    existing.start_date !== imported.start_date ||
    (existing.end_date || null) !== imported.end_date ||
    (existing.notes || null) !== imported.notes
  );
}

export async function parseExpenseExcel(
  file: File,
  existingExpenses: BPFixedExpense[]
): Promise<ImportDiff> {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);
  
  const sheet = workbook.getWorksheet('Charges fixes');
  if (!sheet) {
    return {
      toCreate: [],
      toUpdate: [],
      toDelete: [],
      errors: [{ row: 0, message: 'Feuille "Charges fixes" introuvable dans le fichier' }],
      unchanged: 0,
    };
  }
  
  const existingMap = new Map(existingExpenses.map((e) => [e.id, e]));
  const seenIds = new Set<string>();
  
  const diff: ImportDiff = {
    toCreate: [],
    toUpdate: [],
    toDelete: [],
    errors: [],
    unchanged: 0,
  };
  
  sheet.eachRow((row, rowNumber) => {
    // Skip header row
    if (rowNumber === 1) return;
    
    const id = getCellValue(row.getCell(1))?.toString()?.trim();
    const name = getCellValue(row.getCell(2))?.toString()?.trim();
    const categoryLabel = getCellValue(row.getCell(3))?.toString()?.trim();
    const amountRaw = getCellValue(row.getCell(4));
    const frequencyLabel = getCellValue(row.getCell(5))?.toString()?.trim();
    const vatRaw = getCellValue(row.getCell(6));
    const vatDeductibleRaw = getCellValue(row.getCell(7))?.toString()?.trim();
    const startDateRaw = getCellValue(row.getCell(8));
    const endDateRaw = getCellValue(row.getCell(9));
    const notes = getCellValue(row.getCell(10))?.toString()?.trim() || null;
    
    // Row with existing ID but empty name = deletion
    if (id && existingMap.has(id) && !name) {
      diff.toDelete.push(id);
      seenIds.add(id);
      return;
    }
    
    // Empty row (no name and no ID) = skip
    if (!name) return;
    
    // Parse values
    const amount = typeof amountRaw === 'number' ? amountRaw : parseFloat(String(amountRaw || '0'));
    const vatPercent = typeof vatRaw === 'number' ? vatRaw : parseFloat(String(vatRaw || '20'));
    const vatRate = vatPercent / 100;
    const isVatDeductible = vatDeductibleRaw?.toLowerCase() !== 'non';
    const category = labelToCategory(categoryLabel || '');
    const frequency = labelToFrequency(frequencyLabel || '');
    const startDate = parseDate(startDateRaw) || format(new Date(), 'yyyy-MM-dd');
    const endDate = parseDate(endDateRaw);
    
    // Validation
    if (!name) {
      diff.errors.push({ row: rowNumber, message: 'Nom obligatoire' });
      return;
    }
    
    if (isNaN(amount) || amount < 0) {
      diff.errors.push({ row: rowNumber, message: `Montant invalide: ${amountRaw}` });
      return;
    }
    
    const importedRow: ExpenseImportRow = {
      id: id || undefined,
      name,
      category,
      monthly_amount: amount,
      payment_frequency: frequency,
      vat_rate: vatRate,
      is_vat_deductible: isVatDeductible,
      start_date: startDate,
      end_date: endDate,
      notes,
    };
    
    // New expense (no ID)
    if (!id) {
      diff.toCreate.push(importedRow);
    } 
    // Existing expense (ID matches)
    else if (existingMap.has(id)) {
      seenIds.add(id);
      const existing = existingMap.get(id)!;
      
      if (hasChanges(existing, importedRow)) {
        diff.toUpdate.push({
          id,
          changes: {
            name: importedRow.name,
            category: importedRow.category,
            monthly_amount: importedRow.monthly_amount,
            payment_frequency: importedRow.payment_frequency,
            vat_rate: importedRow.vat_rate,
            is_vat_deductible: importedRow.is_vat_deductible,
            start_date: importedRow.start_date,
            end_date: importedRow.end_date,
            notes: importedRow.notes,
          },
        });
      } else {
        diff.unchanged++;
      }
    }
    // Unknown ID (not in existing list) - treat as error
    else if (id) {
      diff.errors.push({ 
        row: rowNumber, 
        message: `ID "${id}" non reconnu. Supprimez l'ID pour créer une nouvelle charge.` 
      });
    }
  });
  
  return diff;
}
