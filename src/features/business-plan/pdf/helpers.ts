export const formatCurrency = (value: number): string => {
  if (!isFinite(value) || isNaN(value)) return '0 €';
  const rounded = Math.round(value);
  const isNegative = rounded < 0;
  const absValue = Math.abs(rounded);
  const formatted = absValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return isNegative ? `-${formatted} €` : `${formatted} €`;
};

export const formatPercent = (value: number): string => {
  if (!isFinite(value) || isNaN(value)) return '0,0 %';
  return value.toFixed(1).replace('.', ',') + ' %';
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const formatShortDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
};
