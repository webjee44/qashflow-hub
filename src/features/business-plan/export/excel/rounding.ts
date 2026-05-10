// ============================================================
// PR 9 — Frontière d'arrondi (export uniquement)
// ============================================================
// Le moteur (engine/) ne doit JAMAIS arrondir : il propage des
// flottants exacts pour préserver les invariants comptables.
// L'arrondi est appliqué exclusivement à la frontière d'export
// (Excel) pour éviter les artefacts type 1150819.61999999 ou
// 2.619e-10. Toujours appliqué via ces helpers, jamais inline.
// ============================================================

/** Arrondit à l'euro le plus proche, neutralise le bruit IEEE-754. */
export const roundEuro = (n: unknown): number => {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  // Seuil de bruit numérique : tout |v| < 0.005 est traité comme zéro
  // (élimine les 2.6e-10 qui apparaissent par accumulation de soustractions).
  if (Math.abs(v) < 0.005) return 0;
  return Math.round(v);
};

/** Arrondit au centime — réservé aux ratios/marges qui doivent rester précis. */
export const roundCent = (n: unknown): number => {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  if (Math.abs(v) < 0.00005) return 0;
  return Math.round(v * 100) / 100;
};

/** Map un tableau de valeurs à arrondir à l'euro. */
export const roundEuroArr = (arr: readonly number[]): number[] => arr.map(roundEuro);
