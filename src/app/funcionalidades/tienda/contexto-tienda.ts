export function guestStoreSelection(): { tenant_id: string; branch_id: string } | null {
  try {
    const value = JSON.parse(sessionStorage.getItem('vesta-shop-selection') || 'null');
    return typeof value?.tenant_id === 'string' && typeof value?.branch_id === 'string'
      ? value
      : null;
  } catch {
    return null;
  }
}
