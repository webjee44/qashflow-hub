// ============================================================
// PR 0 RED — Mappings hypothèses Excel + frontière d'arrondi (PR 7 + 9)
// ============================================================
// Pour chaque entrée DB non nulle (`monthly_amount`, `gross_salary`,
// `employer_charges_rate`, `initial_stock`, `purchase_amount`,
// `final_stock`), la cellule correspondante de l'onglet « Hypothèses »
// doit être non nulle.
//
// Et : le moteur ne doit PAS arrondir lui-même. Seule la sortie Excel
// arrondit (frontière d'export).
// ============================================================

import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { computeBPModel } from '../computeBPModel';
import { buildBPWorkbook } from '../../export/excel/buildBPWorkbook';
import { cleanEcommerceBPInput } from './__fixtures__/clean-ecommerce';

async function buildWb() {
  const model = computeBPModel(cleanEcommerceBPInput as any);
  return {
    model,
    wb: buildBPWorkbook(model, cleanEcommerceBPInput as any, {
      exportedAt: new Date('2025-06-01T00:00:00Z'),
      companyName: 'Clean Ecommerce',
      engineVersion: model.engineVersion,
    } as any),
  };
}

function collectNumericCells(ws: ExcelJS.Worksheet): number[] {
  const out: number[] = [];
  ws.eachRow((row) => {
    row.eachCell((c) => {
      const v = c.value as any;
      if (typeof v === 'number') out.push(v);
      else if (v && typeof v === 'object' && typeof v.result === 'number') out.push(v.result);
    });
  });
  return out;
}

describe('PR 0 RED — assumptions export mapping (PR 7)', () => {
  it.fails('charge fixe (monthly_amount=1200) → cellule non nulle', async () => {
    const { wb } = await buildWb();
    const ws = wb.getWorksheet('Hypothèses') ?? wb.worksheets.find((w) => /hypoth/i.test(w.name));
    expect(ws).toBeDefined();
    const nums = collectNumericCells(ws!);
    expect(nums.some((n) => Math.abs(n - 1200) < 0.5)).toBe(true);
  });

  it.fails('personnel (gross_salary=3000) → cellule non nulle', async () => {
    const { wb } = await buildWb();
    const ws = wb.getWorksheet('Hypothèses') ?? wb.worksheets.find((w) => /hypoth/i.test(w.name));
    const nums = collectNumericCells(ws!);
    expect(nums.some((n) => Math.abs(n - 3000) < 0.5)).toBe(true);
  });

  it.fails('stocks (initial_stock=100, purchase=500, final=150) → cellules non nulles', async () => {
    const { wb } = await buildWb();
    const ws = wb.getWorksheet('Hypothèses') ?? wb.worksheets.find((w) => /hypoth/i.test(w.name));
    const nums = collectNumericCells(ws!);
    expect(nums.some((n) => Math.abs(n - 100) < 0.5)).toBe(true);
    expect(nums.some((n) => Math.abs(n - 500) < 0.5)).toBe(true);
    expect(nums.some((n) => Math.abs(n - 150) < 0.5)).toBe(true);
  });

  it.fails('charges patronales : valeur DB brute ET valeur normalisée affichées', async () => {
    // Cible PR 7 : deux colonnes "DB brute" / "moteur (normalizeRate)".
    // On teste qu'on retrouve à la fois 0.45 (normalisé) et un libellé
    // distinguant les deux colonnes.
    const { wb } = await buildWb();
    const ws = wb.getWorksheet('Hypothèses') ?? wb.worksheets.find((w) => /hypoth/i.test(w.name));
    expect(ws).toBeDefined();
    const labels: string[] = [];
    ws!.eachRow((row) => row.eachCell((c) => {
      if (typeof c.value === 'string') labels.push(c.value);
    }));
    const hasBrute = labels.some((l) => /db|brut|saisie/i.test(l));
    const hasNorm = labels.some((l) => /normalis|moteur/i.test(l));
    expect(hasBrute && hasNorm).toBe(true);
  });
});

describe('PR 0 RED — frontière d\'arrondi (PR 9)', () => {
  it.fails('aucune cellule numérique avec décimales parasites (>2 décimales)', async () => {
    const { wb } = await buildWb();
    for (const ws of wb.worksheets) {
      const nums = collectNumericCells(ws);
      for (const n of nums) {
        if (!Number.isFinite(n)) continue;
        if (Math.abs(n) < 1e-9) continue;
        const rounded = Math.round(n * 100) / 100;
        expect(
          Math.abs(n - rounded),
          `cellule ${n} dans onglet ${ws.name} a >2 décimales`
        ).toBeLessThan(1e-6);
      }
    }
  });

  it.fails('aucune valeur en notation scientifique résiduelle (|v| < 1e-3 → 0)', async () => {
    const { wb } = await buildWb();
    for (const ws of wb.worksheets) {
      const nums = collectNumericCells(ws);
      for (const n of nums) {
        if (Math.abs(n) > 0 && Math.abs(n) < 1e-3) {
          throw new Error(`cellule quasi-nulle non absorbée: ${n} dans ${ws.name}`);
        }
      }
    }
  });
});
