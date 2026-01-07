
export function normalizeGenre(igdbGenre: string): string {
  if (!igdbGenre) return 'Standard';
  
  const lower = igdbGenre.toLowerCase();

  // Specific IDs based on IGDB Genre IDs
  if (lower.includes('platform')) return '8';
  if (lower.includes('fighting')) return '4';
  if (lower.includes('shooter') || lower.includes('fps') || lower.includes('tps')) return '5';
  if (lower.includes('music') || lower.includes('rhythm')) return '7';
  if (lower.includes('racing') || lower.includes('driving')) return '10';
  if (lower.includes('rpg') || lower.includes('role-playing')) return '12';
  if (lower.includes('sport')) return '14';
  if (lower.includes('adventure')) return '31';
  if (lower.includes('indie')) return '32';
  
  // Strategy & Sub-types
  if (lower.includes('rts') || lower.includes('real-time')) return '11';
  if (lower.includes('turn-based') || lower.includes('turn based')) return '16';
  if (lower.includes('tactical')) return '24';
  if (lower.includes('strategy')) return '15';

  return 'Standard';
}
