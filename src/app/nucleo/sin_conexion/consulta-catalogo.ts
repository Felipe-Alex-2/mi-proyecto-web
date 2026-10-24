export function queryLocalCatalog(products: any[], url: string) {
  const params = new URL(url, 'http://localhost').searchParams;
  const search = (params.get('search') || '').trim().toLocaleLowerCase();
  let items = products.filter((p) => {
    const variants = p.variants || [];
    return (
      (!search ||
        [p.name, p.description, ...variants.map((v: any) => v.sku)]
          .join(' ')
          .toLocaleLowerCase()
          .includes(search)) &&
      (!params.get('category_id') || p.category_id === params.get('category_id')) &&
      (!params.get('season_id') || p.season_id === params.get('season_id')) &&
      (!params.get('gender') || p.gender === params.get('gender')) &&
      (!params.get('size_id') || variants.some((v: any) => v.size_id === params.get('size_id'))) &&
      (!params.get('color_id') ||
        variants.some((v: any) => v.color_id === params.get('color_id'))) &&
      (!params.get('branch_id') ||
        variants.some((v: any) =>
          v.branch_availability.some(
            (b: any) => b.branch_id === params.get('branch_id') && b.quantity > 0,
          ),
        )) &&
      (!params.has('min_price') || p.min_price >= Number(params.get('min_price'))) &&
      (!params.has('max_price') || p.min_price <= Number(params.get('max_price')))
    );
  });
  const sort = params.get('sort_by');
  if (sort === 'price_asc') items = items.sort((a, b) => a.min_price - b.min_price);
  if (sort === 'price_desc') items = items.sort((a, b) => b.min_price - a.min_price);
  if (sort === 'name_asc') items = items.sort((a, b) => a.name.localeCompare(b.name));
  const page = Math.max(1, Number(params.get('page')) || 1),
    page_size = Math.max(1, Math.min(100, Number(params.get('page_size')) || 20));
  return {
    items: items.slice((page - 1) * page_size, page * page_size),
    total: items.length,
    page,
    page_size,
  };
}
