import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  OnDestroy,
  inject,
} from '@angular/core';

@Directive({ selector: '[appShopDialog]', standalone: true })
export class DialogoTiendaDirective implements AfterViewInit, OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly previous = document.activeElement as HTMLElement | null;
  private readonly selector =
    'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]';
  ngAfterViewInit() {
    queueMicrotask(() =>
      this.element.nativeElement.querySelector<HTMLElement>(this.selector)?.focus(),
    );
  }
  @HostListener('document:keydown', ['$event'])
  trap(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const dialogs = document.querySelectorAll('[appShopDialog]');
    if (dialogs.item(dialogs.length - 1) !== this.element.nativeElement) return;
    const elements = Array.from(
      this.element.nativeElement.querySelectorAll<HTMLElement>(this.selector),
    ).filter((el) => el.getClientRects().length);
    const first = elements[0],
      last = elements.at(-1);
    if (!first) {
      event.preventDefault();
      return;
    }
    if (
      !this.element.nativeElement.contains(document.activeElement) ||
      (event.shiftKey && document.activeElement === first)
    ) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  ngOnDestroy() {
    if (this.previous?.isConnected) this.previous.focus();
  }
}
