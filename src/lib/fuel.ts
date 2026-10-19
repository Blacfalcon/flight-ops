// Fuel is recorded in both kilograms and litres, converted with the density held in settings.

export function toBoth(value: number, unit: 'kg' | 'l', densityKgPerL: number): { kg: number; l: number } {
  const round = (n: number) => Math.round(n * 10) / 10;
  if (unit === 'kg') return { kg: round(value), l: round(value / densityKgPerL) };
  return { kg: round(value * densityKgPerL), l: round(value) };
}

export function fuelLabel(kg: number | string, l: number | string): string {
  return `${Number(kg).toLocaleString('en-GB')} kg · ${Number(l).toLocaleString('en-GB')} L`;
}
