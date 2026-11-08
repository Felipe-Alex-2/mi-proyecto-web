export function wholesaleSummary(subtotal:number, quantity:number) {
  const cents=Math.round(subtotal*100);
  const percent=quantity>=13 ? 15 : 0;
  const discount=Math.round(cents*percent/100);
  return {subtotal_before_wholesale:cents/100,wholesale_discount_percent:percent,
    wholesale_discount_amount:discount/100,total_amount:(cents-discount)/100};
}
