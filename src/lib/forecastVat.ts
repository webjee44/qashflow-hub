/**
 * VAT payment derivation for forecast cash-flow.
 *
 * Business rule (régime réel mensuel) :
 *   - VAT collected on revenue of month M minus VAT deductible on expenses of M
 *     is owed to the State and **paid in M+1** (typically by SEPA direct debit
 *     from DGFIP).
 *   - If deductible > collected, no payment is due that month and the credit
 *     is **carried forward** to the next month, reducing future payments.
 *
 * Other régimes:
 *   - `franchise`: company is exempt, no VAT to declare/pay → always 0.
 *   - `quarterly_real` and `simplified`: not yet supported, fall back to
 *     `monthly_real` so users still see something coherent. UI signals
 *     "à venir" for those values until a dedicated implementation lands.
 *
 * This module is pure (no I/O, no React) so it can be exhaustively tested.
 */

export type VatRegime = 'monthly_real' | 'quarterly_real' | 'simplified' | 'franchise';

export const isSupportedVatRegime = (value: string | null | undefined): value is VatRegime =>
  value === 'monthly_real' || value === 'quarterly_real' || value === 'simplified' || value === 'franchise';

export const normalizeVatRegime = (value: string | null | undefined): VatRegime =>
  isSupportedVatRegime(value) ? value : 'monthly_real';

/**
 * Compute the VAT payment due in a given month and the resulting carry forward.
 *
 * @param netVatPreviousMonth Net VAT (collected - deductible) of month M-1
 * @param carryIn             VAT credit carried over from earlier months (positive number)
 * @param regime              Company VAT régime
 */
export interface VatPaymentResult {
  payment: number;
  carryOut: number;
}

export const computeVatPayment = ({
  netVatPreviousMonth,
  carryIn = 0,
  regime,
}: {
  netVatPreviousMonth: number;
  carryIn?: number;
  regime: VatRegime;
}): VatPaymentResult => {
  if (regime === 'franchise') {
    return { payment: 0, carryOut: 0 };
  }

  // V1 fallback: quarterly_real / simplified collapse onto monthly_real until
  // their dedicated logic ships. Users in those régimes see a monthly estimate.
  const safeNet = Number.isFinite(netVatPreviousMonth) ? netVatPreviousMonth : 0;
  const safeCarry = Number.isFinite(carryIn) && carryIn > 0 ? carryIn : 0;

  // Net debt to the State after applying carried-over credit
  const netDebt = safeNet - safeCarry;

  if (netDebt > 0) {
    return { payment: netDebt, carryOut: 0 };
  }

  // No payment due, accumulate the unused credit (positive number).
  // `+ 0` normalises the JS `-0` artefact when netDebt is exactly 0.
  return { payment: 0, carryOut: -netDebt + 0 };
};

/**
 * Decide what to display for the "TVA à décaisser" row for a given month,
 * applying the project-wide "actual écrase forecast" convention
 * (see mem://features/treasury/actuals-consistency).
 */
export type VatPeriodType = 'past' | 'current' | 'future';

export interface VatRowDisplay {
  /** Value to integrate in cash-flow as an outflow (always >= 0). */
  amount: number;
  /** Source of the displayed amount — drives styling and tooltips. */
  source: 'actual' | 'forecast' | 'none';
}

export const getVatRowDisplay = ({
  periodType,
  actualPayment,
  forecastPayment,
}: {
  periodType: VatPeriodType;
  actualPayment: number;
  forecastPayment: number;
}): VatRowDisplay => {
  const safeActual = Number.isFinite(actualPayment) && actualPayment > 0 ? actualPayment : 0;
  const safeForecast = Number.isFinite(forecastPayment) && forecastPayment > 0 ? forecastPayment : 0;

  if (periodType === 'past') {
    if (safeActual > 0) return { amount: safeActual, source: 'actual' };
    return { amount: 0, source: 'none' };
  }

  if (periodType === 'current') {
    if (safeActual > 0) return { amount: safeActual, source: 'actual' };
    return safeForecast > 0
      ? { amount: safeForecast, source: 'forecast' }
      : { amount: 0, source: 'none' };
  }

  // future
  return safeForecast > 0
    ? { amount: safeForecast, source: 'forecast' }
    : { amount: 0, source: 'none' };
};
