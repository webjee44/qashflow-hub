/**
 * categorizeIntercompanyLinks — auto-catégorisation des jambes d'un lien.
 *
 * Pour chaque lien passé, s'assure que chacune de ses deux jambes est
 * catégorisée dans la catégorie standard « C/C <nom société d'en face> »
 * de sa propre société.
 *
 * Règle absolue (idempotence, cf. persistUpdates du moteur de règles) :
 *   ne JAMAIS écraser une catégorie posée par un humain ou une règle.
 *   L'update filtre .is('category_id', null).
 *
 * La catégorie « C/C <nom> » est créée à la volée si absente, avec le bon
 * type (expense pour la sortie, income pour l'entrée) et rattachée à la
 * société détentrice de la jambe.
 */

// deno-lint-ignore-file no-explicit-any

export interface CategorizeResult {
  processed_links: number;
  categorized_legs: number;
  skipped_already_categorized: number;
  created_categories: number;
  errors: string[];
}

interface LinkRow {
  id: string;
  status: string;
  tx_out_id: string;
  tx_in_id: string;
  company_out: string;
  company_in: string;
}

interface TxRow {
  id: string;
  company_id: string;
  category_id: string | null;
  type: 'income' | 'expense';
}

interface CompanyRow {
  id: string;
  name: string;
  user_id: string;
}

function isCcName(name: string, standardName: string): boolean {
  return name.trim().toLowerCase() === standardName.trim().toLowerCase();
}

export async function categorizeIntercompanyLinks(
  client: any,
  linkIds?: string[],
): Promise<CategorizeResult> {
  const result: CategorizeResult = {
    processed_links: 0,
    categorized_legs: 0,
    skipped_already_categorized: 0,
    created_categories: 0,
    errors: [],
  };

  // 1. Charger les liens éligibles (auto_matched / confirmed).
  let linksQ = client
    .from('intercompany_links')
    .select('id, status, tx_out_id, tx_in_id, company_out, company_in')
    .in('status', ['auto_matched', 'confirmed']);
  if (linkIds && linkIds.length > 0) {
    linksQ = linksQ.in('id', linkIds);
  }
  const { data: links, error: linksErr } = await linksQ;
  if (linksErr) throw linksErr;
  const linkRows = (links ?? []) as LinkRow[];
  if (linkRows.length === 0) return result;

  // 2. Charger les sociétés impliquées (name + user_id).
  const companyIds = new Set<string>();
  for (const l of linkRows) {
    companyIds.add(l.company_out);
    companyIds.add(l.company_in);
  }
  const { data: companies, error: cErr } = await client
    .from('companies')
    .select('id, name, user_id')
    .in('id', Array.from(companyIds));
  if (cErr) throw cErr;
  const companyById = new Map<string, CompanyRow>(
    ((companies ?? []) as CompanyRow[]).map(c => [c.id, c]),
  );

  // 3. Charger les transactions (jambes).
  const txIds = new Set<string>();
  for (const l of linkRows) {
    txIds.add(l.tx_out_id);
    txIds.add(l.tx_in_id);
  }
  const { data: txs, error: txErr } = await client
    .from('transactions')
    .select('id, company_id, category_id, type')
    .in('id', Array.from(txIds));
  if (txErr) throw txErr;
  const txById = new Map<string, TxRow>(
    ((txs ?? []) as TxRow[]).map(t => [t.id, t]),
  );

  // 4. Cache des catégories par (company_id, type, name-normalized).
  const categoryCache = new Map<string, string>(); // key -> category_id
  const catKey = (companyId: string, type: 'income' | 'expense', name: string) =>
    `${companyId}|${type}|${name.toLowerCase()}`;

  async function ensureCategory(
    ownerCompany: CompanyRow,
    otherCompany: CompanyRow,
    type: 'income' | 'expense',
  ): Promise<string | null> {
    const standardName = `C/C ${otherCompany.name.trim()}`;
    const key = catKey(ownerCompany.id, type, standardName);
    if (categoryCache.has(key)) return categoryCache.get(key)!;

    // Recherche existante (case-insensitive) du bon type dans la société.
    const { data: existing, error: eErr } = await client
      .from('categories')
      .select('id, name, type')
      .eq('company_id', ownerCompany.id)
      .eq('type', type)
      .ilike('name', standardName);
    if (eErr) throw eErr;
    const match = ((existing ?? []) as Array<{ id: string; name: string; type: string }>)
      .find(c => isCcName(c.name, standardName));
    if (match) {
      categoryCache.set(key, match.id);
      return match.id;
    }

    // Créer la catégorie.
    const { data: created, error: iErr } = await client
      .from('categories')
      .insert({
        user_id: ownerCompany.user_id,
        company_id: ownerCompany.id,
        name: standardName,
        type,
        color: 'hsl(210, 10%, 55%)',
        icon: 'ArrowLeftRight',
        sort_order: 50,
      })
      .select('id')
      .single();
    if (iErr) {
      // Course : quelqu'un d'autre a créé la catégorie entre-temps → refetch.
      if ((iErr as any).code === '23505') {
        const { data: retry } = await client
          .from('categories')
          .select('id, name')
          .eq('company_id', ownerCompany.id)
          .eq('type', type)
          .ilike('name', standardName);
        const found = ((retry ?? []) as Array<{ id: string; name: string }>)
          .find(c => isCcName(c.name, standardName));
        if (found) {
          categoryCache.set(key, found.id);
          return found.id;
        }
      }
      throw iErr;
    }
    result.created_categories++;
    categoryCache.set(key, (created as any).id);
    return (created as any).id;
  }

  // 5. Pour chaque lien, catégoriser les deux jambes non catégorisées.
  for (const link of linkRows) {
    result.processed_links++;
    const legs: Array<{ txId: string; ownerId: string; otherId: string }> = [
      { txId: link.tx_out_id, ownerId: link.company_out, otherId: link.company_in },
      { txId: link.tx_in_id, ownerId: link.company_in, otherId: link.company_out },
    ];

    for (const leg of legs) {
      const tx = txById.get(leg.txId);
      if (!tx) continue;
      if (tx.category_id !== null) {
        result.skipped_already_categorized++;
        continue;
      }
      const owner = companyById.get(leg.ownerId);
      const other = companyById.get(leg.otherId);
      if (!owner || !other) continue;

      try {
        const categoryId = await ensureCategory(owner, other, tx.type);
        if (!categoryId) continue;
        // Idempotence : ne remplace jamais une catégorie déjà posée.
        // On récupère la ligne mise à jour ; length 0 = la course a été perdue.
        const { data: updated, error: uErr } = await client
          .from('transactions')
          .update({ category_id: categoryId })
          .eq('id', tx.id)
          .is('category_id', null)
          .select('id');
        if (uErr) throw uErr;
        if ((updated ?? []).length > 0) {
          result.categorized_legs++;
          tx.category_id = categoryId; // in-memory refresh (safety)
        } else {
          result.skipped_already_categorized++;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        result.errors.push(`link=${link.id} tx=${leg.txId}: ${msg}`);
      }
    }
  }

  return result;
}
