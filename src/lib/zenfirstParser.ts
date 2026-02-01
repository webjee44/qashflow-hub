/**
 * Zenfirst CSV/XLSX Parser
 * Parses treasury plan exports from Zenfirst with hierarchy detection
 */

export interface ZenfirstItem {
  name: string;
  level: number; // 1 = group, 2+ = category/subcategory
  type: 'income' | 'expense';
  parentName: string | null;
  monthlyAmounts: Record<string, number>; // "2026-01-01" => 30647
  isGroup: boolean; // true if this item has children
  totalAmount: number;
}

export interface ZenfirstParseResult {
  companyName: string;
  startDate: string;
  endDate: string;
  months: string[]; // ISO format: "2026-01-01"
  items: ZenfirstItem[];
  errors: string[];
}

// French month names to ISO format
const MONTHS_FR: Record<string, string> = {
  'janvier': '01',
  'février': '02',
  'fevrier': '02',
  'mars': '03',
  'avril': '04',
  'mai': '05',
  'juin': '06',
  'juillet': '07',
  'août': '08',
  'aout': '08',
  'septembre': '09',
  'octobre': '10',
  'novembre': '11',
  'décembre': '12',
  'decembre': '12',
};

/**
 * Parse French month name to ISO date format
 * "Janvier 2026" => "2026-01-01"
 */
export function parseZenfirstMonth(monthName: string): string | null {
  const parts = monthName.trim().toLowerCase().split(/\s+/);
  if (parts.length !== 2) return null;
  
  const [name, year] = parts;
  const monthNum = MONTHS_FR[name];
  
  if (!monthNum || !year.match(/^\d{4}$/)) return null;
  
  return `${year}-${monthNum}-01`;
}

/**
 * Parse French number format to number
 * "30 647" => 30647
 * "-24 802" => -24802
 * "1 705,50" => 1705.5
 */
export function parseZenfirstAmount(value: string): number {
  if (!value || value.trim() === '') return 0;
  
  // Remove all spaces (thousand separators) and replace comma with dot
  const cleaned = value.trim().replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  
  return isNaN(num) ? 0 : num;
}

/**
 * Get indentation level from a line
 * 8 spaces = level 1 (direct child of section)
 * 16 spaces = level 2 (sub-category)
 * 24 spaces = level 3 (sub-sub-category)
 */
function getIndentLevel(line: string): number {
  const match = line.match(/^(\s*)/);
  if (!match) return 0;
  
  const spaces = match[1].length;
  // Each level is 8 spaces, minimum level is 1 for items with any indentation
  if (spaces === 0) return 0;
  return Math.max(1, Math.floor(spaces / 8));
}

/**
 * Check if a line is a section header (Encaissements, Décaissements)
 */
function isSectionHeader(name: string): 'income' | 'expense' | null {
  const lower = name.toLowerCase().trim();
  if (lower === 'encaissements') return 'income';
  if (lower === 'décaissements' || lower === 'decaissements') return 'expense';
  return null;
}

/**
 * Check if a line should be ignored (totals, empty, metadata, system rows)
 */
function shouldIgnoreLine(name: string): boolean {
  const lower = name.toLowerCase().trim();
  const ignorePatterns = [
    'en début de mois',
    'en fin de mois',
    'variation',
    'ignorés',
    'mes indicateurs',
    'total',
    'en €',
    'scénario',
    'entreprise',
    'plan de trésorerie',
    'non catégorisés', // We skip uncategorized as they need to be categorized in the app
  ];
  
  return ignorePatterns.some(pattern => lower.startsWith(pattern)) || lower === '';
}

/**
 * Parse a Zenfirst CSV content
 */
export function parseZenfirstCSV(content: string): ZenfirstParseResult {
  const result: ZenfirstParseResult = {
    companyName: '',
    startDate: '',
    endDate: '',
    months: [],
    items: [],
    errors: [],
  };
  
  const lines = content.split('\n');
  if (lines.length < 5) {
    result.errors.push('Fichier trop court, format non reconnu');
    return result;
  }
  
  // Parse header lines
  // Line 1: Company name
  const companyLine = lines[0]?.split(';')[0] || '';
  if (companyLine.toLowerCase().startsWith('entreprise:')) {
    result.companyName = companyLine.replace(/entreprise:\s*/i, '').trim();
  }
  
  // Line 2: Date range
  const dateLine = lines[1]?.split(';')[0] || '';
  const dateMatch = dateLine.match(/du (\d{2}\/\d{2}\/\d{4}) au (\d{2}\/\d{2}\/\d{4})/);
  if (dateMatch) {
    // Convert DD/MM/YYYY to YYYY-MM-DD
    const [, start, end] = dateMatch;
    const [sd, sm, sy] = start.split('/');
    const [ed, em, ey] = end.split('/');
    result.startDate = `${sy}-${sm}-${sd}`;
    result.endDate = `${ey}-${em}-${ed}`;
  }
  
  // Line 3: Month headers
  const headerLine = lines[2]?.split(';') || [];
  for (let i = 1; i < headerLine.length - 1; i++) { // Skip first (scenario) and last (Total)
    const monthStr = headerLine[i]?.trim();
    if (monthStr && !monthStr.toLowerCase().includes('total')) {
      const isoMonth = parseZenfirstMonth(monthStr);
      if (isoMonth) {
        result.months.push(isoMonth);
      }
    }
  }
  
  // Parse data lines
  let currentType: 'income' | 'expense' | null = null;
  const parentStack: { name: string; level: number }[] = [];
  const itemsByName = new Map<string, ZenfirstItem>();
  
  for (let i = 3; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === '' || line.startsWith(';')) continue;
    
    const cells = line.split(';');
    const nameCell = cells[0] || '';
    const name = nameCell.trim();
    
    if (shouldIgnoreLine(name)) continue;
    
    // Check for section header
    const sectionType = isSectionHeader(name);
    if (sectionType) {
      currentType = sectionType;
      parentStack.length = 0; // Reset parent stack
      continue;
    }
    
    if (!currentType) continue;
    
    const level = getIndentLevel(nameCell);
    // Accept level >= 1 (items with at least 8 spaces indentation)
    if (level < 1) continue;
    
    // Update parent stack
    while (parentStack.length > 0 && parentStack[parentStack.length - 1].level >= level) {
      parentStack.pop();
    }
    
    const parentName = parentStack.length > 0 ? parentStack[parentStack.length - 1].name : null;
    
    // Parse monthly amounts
    const monthlyAmounts: Record<string, number> = {};
    let totalAmount = 0;
    
    for (let j = 0; j < result.months.length && j + 1 < cells.length; j++) {
      const amount = parseZenfirstAmount(cells[j + 1] || '');
      // For both income and expenses, we store absolute values
      const absAmount = Math.abs(amount);
      monthlyAmounts[result.months[j]] = absAmount;
      totalAmount += absAmount;
    }
    
    const item: ZenfirstItem = {
      name,
      level,
      type: currentType,
      parentName,
      monthlyAmounts,
      isGroup: false, // Will be updated later
      totalAmount,
    };
    
    // Use unique key to avoid duplicates (same name can appear in income and expense)
    const uniqueKey = `${currentType}-${name}`;
    itemsByName.set(uniqueKey, item);
    result.items.push(item);
    
    // Add to parent stack for potential children
    parentStack.push({ name, level });
    
    // Mark parent as group if exists
    if (parentName) {
      const parentKey = `${currentType}-${parentName}`;
      const parent = itemsByName.get(parentKey);
      if (parent) {
        parent.isGroup = true;
      }
    }
  }
  
  return result;
}

/**
 * Get only leaf items (items without children)
 */
export function getLeafItems(items: ZenfirstItem[]): ZenfirstItem[] {
  return items.filter(item => !item.isGroup);
}

/**
 * Get only group items (items with children)
 */
export function getGroupItems(items: ZenfirstItem[]): ZenfirstItem[] {
  return items.filter(item => item.isGroup);
}

/**
 * Generate a color based on index and type
 */
export function generateColor(index: number, type: 'income' | 'expense'): string {
  const hues = type === 'income' 
    ? [142, 173, 200, 155, 185] // Greens and teals
    : [0, 280, 320, 38, 221, 250]; // Reds, purples, oranges, blues
  
  const hue = hues[index % hues.length];
  const saturation = 60 + (index % 3) * 10;
  const lightness = 45 + (index % 2) * 10;
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
