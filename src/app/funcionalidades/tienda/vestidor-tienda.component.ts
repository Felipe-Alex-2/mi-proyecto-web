import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, firstValueFrom, forkJoin, of } from 'rxjs';
import { TiendaService } from './tienda.service';
import { CatalogProduct } from '../../nucleo/modelos/catalogo.model';
import { DialogoTiendaDirective } from './dialogo-tienda.directive';

interface Measurements {
  gender: string;
  height_cm: number | null;
  weight_kg: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  photo_url?: string | null;
}
interface SizeResult {
  recommended_size: string;
  confidence_score: number;
  fit_overall: string;
  fit_details: { zone: string; message: string }[];
  suggested_variant_id?: string;
}
interface FittingSession {
  session_id: string;
  result_image_url: string;
  recommended_size: string;
  confidence_score: number;
  fit_feedback: string;
  created_at: string;
  product_id: string;
}
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DialogoTiendaDirective],
  styleUrls: ['./tienda.css', './vestidor-tienda.component.css'],
  templateUrl: './vestidor-tienda.component.html',
})
export class VestidorTiendaComponent {
  readonly shop = inject(TiendaService);
  readonly route = inject(ActivatedRoute);
  readonly destroyRef = inject(DestroyRef);
  readonly products = signal<CatalogProduct[]>([]);
  readonly productId = signal(this.route.snapshot.queryParamMap.get('product') || '');
  readonly product = computed(() => this.products().find((p) => p.id === this.productId()));
  readonly busy = signal(false);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly sizeResult = signal<SizeResult | null>(null);
  readonly sessions = signal<FittingSession[]>([]);
  readonly personPhoto = signal('');
  readonly garmentPhoto = signal('');
  readonly resultImage = signal('');
  readonly cameraOpen = signal(false);
  readonly video = viewChild<ElementRef<HTMLVideoElement>>('camera');
  private stream: MediaStream | null = null;
  private personFile: Blob | null = null;
  private garmentFile: Blob | null = null;
  readonly fields = [
    { key: 'height_cm', label: 'Altura (cm)', min: 80, max: 250 },
    { key: 'weight_kg', label: 'Peso (kg)', min: 20, max: 300 },
    { key: 'chest_cm', label: 'Pecho (cm)', min: 40, max: 200 },
    { key: 'waist_cm', label: 'Cintura (cm)', min: 30, max: 200 },
    { key: 'hip_cm', label: 'Cadera (cm)', min: 40, max: 200 },
  ] as const;
  measurements: Measurements = this.emptyMeasurements();
  private emptyMeasurements(): Measurements {
    return {
      gender: 'MUJER',
      height_cm: null,
      weight_kg: null,
      chest_cm: null,
      waist_cm: null,
      hip_cm: null,
    };
  }
  constructor() {
    effect((onCleanup) => {
      const ready = this.shop.ready(),
        scope = this.shop.scope();
      this.stopCamera();
      this.sizeResult.set(null);
      this.resultImage.set('');
      this.personPhoto.set('');
      this.garmentPhoto.set('');
      this.personFile = null;
      this.garmentFile = null;
      this.sessions.set([]);
      this.products.set([]);
      this.loading.set(true);
      this.error.set('');
      this.measurements = this.emptyMeasurements();
      if (!ready) return;
      const selectedId = this.route.snapshot.queryParamMap.get('product');
      const request = forkJoin({
        products: this.shop.products({ page_size: 100 }),
        selected: selectedId ? this.shop.product(selectedId) : of(null),
        profile: this.shop.http.get<Measurements | null>(
          `${this.shop.api}/virtual-fitting/profile`,
        ),
        sessions: this.shop.http.get<FittingSession[]>(`${this.shop.api}/virtual-fitting/sessions`),
      }).subscribe({
        next: (data) => {
          if (scope !== this.shop.scope()) return;
          this.products.set(
            data.selected && !data.products.items.some((p) => p.id === data.selected!.id)
              ? [data.selected, ...data.products.items]
              : data.products.items,
          );
          this.sessions.set(data.sessions);
          if (data.profile) {
            this.measurements = data.profile;
            this.personPhoto.set(data.profile.photo_url || '');
          }
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          this.error.set(
            typeof e?.error?.detail === 'string'
              ? e.error.detail
              : 'No se pudo cargar el vestidor.',
          );
        },
      });
      onCleanup(() => request.unsubscribe());
    });
    effect(() => {
      const video = this.video()?.nativeElement;
      if (video && this.stream && this.cameraOpen()) {
        video.srcObject = this.stream;
        video
          .play()
          .catch(() => this.error.set('No se pudo iniciar la cámara. Puedes cargar una foto.'));
      }
    });
    this.destroyRef.onDestroy(() => this.stopCamera());
  }
  save(form: NgForm) {
    if (form.invalid || this.busy()) {
      form.control.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    const scope = this.shop.scope();
    this.shop.http
      .post<Measurements>(`${this.shop.api}/virtual-fitting/profile`, {
        ...this.measurements,
        photo_url: this.personPhoto() || null,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (profile) => {
          if (scope === this.shop.scope()) {
            this.measurements = profile;
            this.success.set('Tus medidas están guardadas y disponibles con tu cuenta.');
          }
        },
        error: (e) => this.error.set(e?.error?.detail || 'No se pudieron guardar tus medidas.'),
      });
  }
  recommend(form: NgForm) {
    if (!this.productId() || this.busy() || form.invalid) {
      form.control.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set('');
    const scope = this.shop.scope();
    this.shop.http
      .post<SizeResult>(`${this.shop.api}/virtual-fitting/recommend-size`, {
        ...this.measurements,
        product_id: this.productId(),
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (result) => {
          if (scope === this.shop.scope()) this.sizeResult.set(result);
        },
        error: (e) => this.error.set(e?.error?.detail || 'No se pudo recomendar una talla.'),
      });
  }
  async selectPhoto(event: Event, person = true) {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 8 * 1024 * 1024) {
      this.error.set('Usa una imagen JPG, PNG o WebP de hasta 8 MB.');
      return;
    }
    const scope = this.shop.scope();
    const reader = new FileReader();
    reader.onload = () => {
      if (scope !== this.shop.scope()) return;
      if (person) {
        this.personFile = file;
        this.personPhoto.set(String(reader.result));
      } else {
        this.garmentFile = file;
        this.garmentPhoto.set(String(reader.result));
      }
      this.resultImage.set('');
    };
    reader.readAsDataURL(file);
  }
  async camera() {
    this.error.set('');
    const scope = this.shop.scope();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      if (this.destroyRef.destroyed || scope !== this.shop.scope()) {
        this.stopCamera();
        return;
      }
      this.cameraOpen.set(true);
    } catch {
      this.error.set(
        'No se pudo acceder a la cámara. Revisa el permiso del navegador o carga una foto.',
      );
    }
  }
  snapshot() {
    const video = this.video()?.nativeElement;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(video.videoWidth, 1200);
    canvas.height = (video.videoHeight * canvas.width) / video.videoWidth;
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const scope = this.shop.scope();
    canvas.toBlob(
      (blob) => {
        if (blob && scope === this.shop.scope()) {
          this.personFile = blob;
          this.personPhoto.set(canvas.toDataURL('image/jpeg', 0.9));
        }
      },
      'image/jpeg',
      0.9,
    );
    this.stopCamera();
  }
  stopCamera() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.cameraOpen.set(false);
  }
  changeProduct(id: string) {
    this.productId.set(id);
    this.sizeResult.set(null);
    this.resultImage.set('');
    this.garmentFile = null;
    this.garmentPhoto.set('');
  }
  async tryOn() {
    if (this.busy() || !this.personPhoto() || (!this.product()?.image_url && !this.garmentFile))
      return;
    this.busy.set(true);
    this.error.set('');
    this.resultImage.set('');
    const scope = this.shop.scope();
    try {
      const person =
        this.personFile || (await (await fetch(this.shop.image(this.personPhoto()))).blob());
      let garment = this.garmentFile;
      if (!garment) {
        try {
          garment = await firstValueFrom(
            this.shop.http.get(this.shop.image(this.product()!.image_url), {
              responseType: 'blob',
            }),
          );
        } catch {
          throw new Error(
            'No se pudo leer la foto de la prenda. Carga su imagen en el campo Foto de la prenda y vuelve a intentar.',
          );
        }
      }
      if (scope !== this.shop.scope() || this.destroyRef.destroyed) return;
      const body = new FormData();
      body.append('person_image', person, 'persona.jpg');
      body.append('garment_image', garment, 'prenda.png');
      body.append('garment_description', this.product()?.name || 'Prenda seleccionada');
      const result = await firstValueFrom(
        this.shop.http
          .post<{ result_image_b64: string; mime_type: string }>(
            `${this.shop.api}/virtual-fitting/idm-tryon`,
            body,
          )
          .pipe(takeUntilDestroyed(this.destroyRef)),
      );
      if (scope === this.shop.scope())
        this.resultImage.set(`data:${result.mime_type};base64,${result.result_image_b64}`);
    } catch (e: any) {
      if (!this.destroyRef.destroyed && scope === this.shop.scope())
        this.error.set(
          e?.status === 503
            ? 'El servicio de prueba con IA no está disponible en este momento. Puedes seguir consultando tu talla y volver a intentarlo más tarde.'
            : e?.error?.detail || e?.message || 'No se pudo generar la prueba virtual.',
        );
    } finally {
      this.busy.set(false);
    }
  }
}
