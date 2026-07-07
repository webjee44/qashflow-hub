/**
 * computeIntercompanyPositions — moteur pur de calcul des positions comptes courants
 * intergroupes.
 *
 * Sémantique : un virement A → B est une AVANCE ; le récepteur B doit à l'émetteur A.
 * Le solde d'une paire (A, B) = Σ(A→B) − Σ(B→A) ; s'il est > 0, B doit à A ce montant.
 *
 * Une position de compte courant est un STOCK : le solde affiché est TOUJOURS cumulé
 * depuis le début des données. La période ne filtre QUE la « variation » et le nombre
 * de mouvements retenus dans cette fenêtre.
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
  /** Date de la transaction sortie (YYYY-MM-DD ou ISO). Source de vérité période. */
  tx_date: string;
}

export interface PositionOptions {
  /** Statuts à inclure. Défaut : ['auto_matched', 'confirmed']. */
  includeStatuses?: IntercompanyLinkStatus[];
  /** Fenêtre pour la variation & le comptage. Défaut : toute la période. */
  periodFrom?: string;
  periodTo?: string;
}

/**
 * Position bilatérale entre deux sociétés (paire ordonnée alphabétiquement).
 * Le solde est TOUJOURS cumulé (pas de filtre période).
 */
export interface PairPosition {
  /** company_a < company_b (ordre stable, indépendant du sens). */
  company_a: string;
  company_b: string;
  /** Total cumulé des avances a→b (depuis toujours). */
  gross_a_to_b: number;
  /** Total cumulé des avances b→a (depuis toujours). */
  gross_b_to_a: number;
  /**
   * Solde de compte courant = gross_a_to_b − gross_b_to_a (cumulé).
   * Si > 0 : b doit à a.
   * Si < 0 : a doit à b.
   */
  balance_a_to_b: number;
  /** Société qui DOIT (débiteur net). null si équilibré. */
  debtor: string | null;
  /** Société à qui l'on doit (créancier net). null si équilibré. */
  creditor: string | null;
  /** |balance_a_to_b| — montant absolu de la position ouverte. */
  balance_abs: number;
  /** Variation du solde a→b sur la période (positif si la dette de b envers a a grandi). */
  variation_period: number;
  /** Nombre de mouvements sur la période. */
  movements_period: number;
  /** Nombre total de mouvements cumulés (tous sens confondus). */
  movements_total: number;
}

/** Détail par contrepartie du point de vue d'une société. */
export interface CounterpartyPosition {
  counterparty: string;
  /**
   * Solde vu par la société : > 0 => la contrepartie lui doit ce montant ;
   * < 0 => la société doit ce montant à la contrepartie.
   */
  balance: number;
  movements_total: number;
  movements_period: number;
  variation_period: number;
}

/** Position nette d'une société vis-à-vis du reste du groupe. */
export interface CompanyPosition {
  company_id: string;
  /** Σ des soldes positifs (ce que le groupe lui doit). */
  total_receivable: number;
  /** Σ des soldes négatifs en valeur absolue (ce qu'elle doit au groupe). */
  total_debt: number;
  /** total_receivable − total_debt. */
  net: number;
  counterparties: CounterpartyPosition[];
}

export interface IntercompanyAggregate {
  /** Positions triées par |solde| décroissant. Inclut les positions équilibrées (balance_abs = 0) uniquement si elles ont des mouvements. */
  positions: PairPosition[];
  /** Positions ouvertes uniquement (balance_abs > 0). */
  openPositions: PairPosition[];
  /** Société la plus créancière (net > 0 maximum), null si aucune. */
  topCreditor: CompanyPosition | null;
  /** Société la plus débitrice (net < 0 minimum), null si aucune. */
  topDebtor: CompanyPosition | null;
  /** Σ des |soldes| des positions ouvertes. Mesure la « masse » des positions à régler. */
  totalOpenPositions: number;
  /** Positions par société. */
  perCompany: CompanyPosition[];
}

const DEFAULT_STATUSES: IntercompanyLinkStatus[] = ['auto_matched', 'confirmed'];

function pairKey(a: string, b: string): { key: string; ordered: [string, string] } {
  const ordered: [string, string] = a < b ? [a, b] : [b, a];
  return { key: `${ordered[0]}|${ordered[1]}`, ordered };
}

function inPeriod(date: string, from?: string, to?: string): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function computeIntercompanyPositions(
  links: IntercompanyLinkForAgg[],
  options: PositionOptions = {},
): IntercompanyAggregate {
  const statuses = new Set(options.includeStatuses ?? DEFAULT_STATUSES);
  const from = options.periodFrom;
  const to = options.periodTo;

  interface Bucket {
    a: string;
    b: string;
    a_to_b_total: number;
    b_to_a_total: number;
    a_to_b_period: number;
    b_to_a_period: number;
    count_total: number;
    count_period: number;
  }
  const pairMap = new Map<string, Bucket>();

  for (const link of links) {
    if (!statuses.has(link.status)) continue;
    const amount = Math.abs(link.amount);
    if (amount === 0) continue;

    const { key, ordered } = pairKey(link.company_out, link.company_in);
    const [a, b] = ordered;
    const bucket: Bucket =
      pairMap.get(key) ?? {
        a,
        b,
        a_to_b_total: 0,
        b_to_a_total: 0,
        a_to_b_period: 0,
        b_to_a_period: 0,
        count_total: 0,
        count_period: 0,
      };

    const isAtoB = link.company_out === a;
    if (isAtoB) bucket.a_to_b_total += amount;
    else bucket.b_to_a_total += amount;
    bucket.count_total += 1;

    if (inPeriod(link.tx_date, from, to)) {
      if (isAtoB) bucket.a_to_b_period += amount;
      else bucket.b_to_a_period += amount;
      bucket.count_period += 1;
    }

    pairMap.set(key, bucket);
  }

  const positions: PairPosition[] = [];
  for (const b of pairMap.values()) {
    const balance = b.a_to_b_total - b.b_to_a_total;
    const variation = b.a_to_b_period - b.b_to_a_period;
    positions.push({
      company_a: b.a,
      company_b: b.b,
      gross_a_to_b: b.a_to_b_total,
      gross_b_to_a: b.b_to_a_total,
      balance_a_to_b: balance,
      balance_abs: Math.abs(balance),
      debtor: balance === 0 ? null : balance > 0 ? b.b : b.a,
      creditor: balance === 0 ? null : balance > 0 ? b.a : b.b,
      variation_period: variation,
      movements_period: b.count_period,
      movements_total: b.count_total,
    });
  }

  positions.sort((x, y) => y.balance_abs - x.balance_abs);
  const openPositions = positions.filter(p => p.balance_abs > 0);

  // Positions par société : agréger les soldes de toutes les paires où la société apparaît.
  const perCompanyMap = new Map<
    string,
    {
      company_id: string;
      total_receivable: number;
      total_debt: number;
      counterparties: Map<string, CounterpartyPosition>;
    }
  >();

  const ensureCompany = (id: string) => {
    let c = perCompanyMap.get(id);
    if (!c) {
      c = {
        company_id: id,
        total_receivable: 0,
        total_debt: 0,
        counterparties: new Map(),
      };
      perCompanyMap.set(id, c);
    }
    return c;
  };

  for (const p of positions) {
    // Point de vue A
    const a = ensureCompany(p.company_a);
    if (p.balance_a_to_b > 0) a.total_receivable += p.balance_a_to_b;
    else if (p.balance_a_to_b < 0) a.total_debt += -p.balance_a_to_b;
    a.counterparties.set(p.company_b, {
      counterparty: p.company_b,
      balance: p.balance_a_to_b,
      movements_total: p.movements_total,
      movements_period: p.movements_period,
      variation_period: p.variation_period,
    });

    // Point de vue B (signes inversés)
    const b = ensureCompany(p.company_b);
    if (p.balance_a_to_b < 0) b.total_receivable += -p.balance_a_to_b;
    else if (p.balance_a_to_b > 0) b.total_debt += p.balance_a_to_b;
    b.counterparties.set(p.company_a, {
      counterparty: p.company_a,
      balance: -p.balance_a_to_b,
      movements_total: p.movements_total,
      movements_period: p.movements_period,
      variation_period: -p.variation_period,
    });
  }

  const perCompany: CompanyPosition[] = Array.from(perCompanyMap.values()).map(c => ({
    company_id: c.company_id,
    total_receivable: c.total_receivable,
    total_debt: c.total_debt,
    net: c.total_receivable - c.total_debt,
    counterparties: Array.from(c.counterparties.values()).sort(
      (x, y) => Math.abs(y.balance) - Math.abs(x.balance),
    ),
  }));

  const topCreditor =
    perCompany
      .filter(c => c.net > 0)
      .sort((x, y) => y.net - x.net)[0] ?? null;
  const topDebtor =
    perCompany
      .filter(c => c.net < 0)
      .sort((x, y) => x.net - y.net)[0] ?? null;

  const totalOpenPositions = openPositions.reduce((s, p) => s + p.balance_abs, 0);

  return {
    positions,
    openPositions,
    topCreditor,
    topDebtor,
    totalOpenPositions,
    perCompany: perCompany.sort((x, y) => y.net - x.net),
  };
}

// ------------------------------------------------------------
// Helpers de presets de période
// ------------------------------------------------------------

export type PeriodPresetKey = 'all' | 'y2026' | 'y2025' | '12m';

export interface PeriodBounds {
  from?: string;
  to?: string;
}

/**
 * Presets de période, exprimés en dates de transactions (YYYY-MM-DD).
 * `all` => aucune borne.
 */
export function resolvePeriodPreset(key: PeriodPresetKey, today: Date = new Date()): PeriodBounds {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (key === 'all') return {};
  if (key === 'y2026') return { from: '2026-01-01', to: '2026-12-31' };
  if (key === 'y2025') return { from: '2025-01-01', to: '2025-12-31' };
  if (key === '12m') {
    const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const from = new Date(to.getTime());
    from.setUTCFullYear(from.getUTCFullYear() - 1);
    return { from: iso(from), to: iso(to) };
  }
  return {};
}
