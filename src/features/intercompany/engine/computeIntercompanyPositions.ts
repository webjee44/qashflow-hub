/**
 * computeIntercompanyPositions — moteur pur d'agrégation des flux intergroupes.
 *
 * Prend en entrée les liens intercompany déjà décidés (auto/confirmed/suggested)
 * et calcule :
 *  - la matrice des flux BRUTS par couple ordonné (out → in)
 *  - la position NETTE par paire non ordonnée (A→B moins B→A)
 *  - les totaux par société et global
 *
 * Aucune I/O. Aucune dépendance UI. Testable unitaire.
 */

export type IntercompanyLinkStatus =
  | 'auto_matched'
  | 'confirmed'
  | 'suggested'
  | 'rejected';

export interface IntercompanyLinkForAgg {
  company_out: string;
  company_in: string;
  amount: number;
  status: IntercompanyLinkStatus;
  matched_at: string; // ISO
}

export interface AggregateOptions {
  /** Statuts à inclure. Défaut : ['auto_matched', 'confirmed']. */
  includeStatuses?: IntercompanyLinkStatus[];
  /** Date min inclusive (ISO). */
  from?: string;
  /** Date max inclusive (ISO). */
  to?: string;
}

export interface DirectionalFlow {
  company_out: string;
  company_in: string;
  gross_amount: number;
  link_count: number;
}

export interface NetPosition {
  /** company_a < company_b (ordre stable, indépendant du sens). */
  company_a: string;
  company_b: string;
  /** Somme des flux a→b. */
  gross_a_to_b: number;
  /** Somme des flux b→a. */
  gross_b_to_a: number;
  /** gross_a_to_b - gross_b_to_a. Signe > 0 => a a envoyé net à b. */
  net_a_to_b: number;
  /** nb total de liens (deux sens confondus). */
  link_count: number;
}

export interface CompanyTotals {
  company_id: string;
  outflow: number;
  inflow: number;
  net: number; // inflow - outflow
  link_count: number;
}

export interface IntercompanyAggregate {
  directional: DirectionalFlow[];
  net: NetPosition[];
  perCompany: CompanyTotals[];
  totalGross: number;
  totalLinks: number;
}

const DEFAULT_STATUSES: IntercompanyLinkStatus[] = ['auto_matched', 'confirmed'];

function pairKey(a: string, b: string): { key: string; ordered: [string, string] } {
  const ordered: [string, string] = a < b ? [a, b] : [b, a];
  return { key: `${ordered[0]}|${ordered[1]}`, ordered };
}

export function computeIntercompanyPositions(
  links: IntercompanyLinkForAgg[],
  options: AggregateOptions = {},
): IntercompanyAggregate {
  const statuses = new Set(options.includeStatuses ?? DEFAULT_STATUSES);
  const from = options.from ?? null;
  const to = options.to ?? null;

  const directionalMap = new Map<string, DirectionalFlow>();
  const pairMap = new Map<
    string,
    { a: string; b: string; a_to_b: number; b_to_a: number; count: number }
  >();
  const perCompanyMap = new Map<string, CompanyTotals>();
  let totalGross = 0;
  let totalLinks = 0;

  for (const link of links) {
    if (!statuses.has(link.status)) continue;
    if (from && link.matched_at < from) continue;
    if (to && link.matched_at > to) continue;

    const amount = Math.abs(link.amount);
    totalGross += amount;
    totalLinks += 1;

    // Directional (out → in)
    const dirKey = `${link.company_out}|${link.company_in}`;
    const dir = directionalMap.get(dirKey);
    if (dir) {
      dir.gross_amount += amount;
      dir.link_count += 1;
    } else {
      directionalMap.set(dirKey, {
        company_out: link.company_out,
        company_in: link.company_in,
        gross_amount: amount,
        link_count: 1,
      });
    }

    // Net (unordered pair)
    const { key, ordered } = pairKey(link.company_out, link.company_in);
    const [a, b] = ordered;
    const bucket = pairMap.get(key) ?? { a, b, a_to_b: 0, b_to_a: 0, count: 0 };
    if (link.company_out === a) bucket.a_to_b += amount;
    else bucket.b_to_a += amount;
    bucket.count += 1;
    pairMap.set(key, bucket);

    // Per company
    const outC = perCompanyMap.get(link.company_out) ?? {
      company_id: link.company_out,
      outflow: 0,
      inflow: 0,
      net: 0,
      link_count: 0,
    };
    outC.outflow += amount;
    outC.link_count += 1;
    perCompanyMap.set(link.company_out, outC);

    const inC = perCompanyMap.get(link.company_in) ?? {
      company_id: link.company_in,
      outflow: 0,
      inflow: 0,
      net: 0,
      link_count: 0,
    };
    inC.inflow += amount;
    inC.link_count += 1;
    perCompanyMap.set(link.company_in, inC);
  }

  const net: NetPosition[] = [];
  for (const bucket of pairMap.values()) {
    net.push({
      company_a: bucket.a,
      company_b: bucket.b,
      gross_a_to_b: bucket.a_to_b,
      gross_b_to_a: bucket.b_to_a,
      net_a_to_b: bucket.a_to_b - bucket.b_to_a,
      link_count: bucket.count,
    });
  }

  const perCompany: CompanyTotals[] = [];
  for (const c of perCompanyMap.values()) {
    perCompany.push({ ...c, net: c.inflow - c.outflow });
  }

  return {
    directional: Array.from(directionalMap.values()).sort(
      (a, b) => b.gross_amount - a.gross_amount,
    ),
    net: net.sort((a, b) => Math.abs(b.net_a_to_b) - Math.abs(a.net_a_to_b)),
    perCompany: perCompany.sort((a, b) => b.link_count - a.link_count),
    totalGross,
    totalLinks,
  };
}
