import { wholesaleSummary } from './venta-mayor';

describe('Wholesale totals',()=>{
  for(const quantity of [12,13,26,52]) it(`uses a single 15% discount for ${quantity} units`,()=>{
    const result=wholesaleSummary(quantity*10,quantity);
    expect(result.wholesale_discount_percent).toBe(quantity>=13?15:0);
    expect(result.total_amount).toBe(quantity>=13?quantity*8.5:quantity*10);
  });
  it('removes the discount as soon as the order falls below thirteen units',()=>{
    expect(wholesaleSummary(130,13).wholesale_discount_amount).toBe(19.5);
    expect(wholesaleSummary(120,12).wholesale_discount_amount).toBe(0);
  });
});
