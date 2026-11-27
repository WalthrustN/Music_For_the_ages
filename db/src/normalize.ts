export function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/['’‘]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export const YEAR_MIN = 1860
export const YEAR_MAX = 2100
