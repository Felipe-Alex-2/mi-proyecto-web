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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { DatePipe } from '@angular/common';
import { CatalogoSinConexion } from '../../nucleo/sin_conexion/catalogo-sin-conexion.service';
import { CambiosPendientesComponent } from '../../nucleo/sin_conexion/cambios-pendientes.component';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion.service';
import { SelectorTiendaComponent } from '../../nucleo/componentes/selector-tienda.component';
import { AvatarId } from '../../nucleo/modelos/usuario.model';
import { AvatarUsuarioComponent } from '../../nucleo/componentes/avatar-usuario.component';
import { sinEspaciosVaciosValidator, longitudMinimaSinEspacios } from '../../nucleo/validadores/validadores-personalizados';

@Component({
  standalone: true,
  selector: 'app-profile',
  imports: [DatePipe, ReactiveFormsModule, AvatarUsuarioComponent, SelectorTiendaComponent, CambiosPendientesComponent],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css',
})
export class PerfilComponent {
  readonly offlineCatalog = inject(CatalogoSinConexion);
  readonly auth = inject(AutenticacionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly avatars: { id: AvatarId; name: string }[] = [
    { id: 'terracotta', name: 'Terracota' },
    { id: 'sage', name: 'Salvia' },
    { id: 'sand', name: 'Arena' },
  ];
  readonly selectedAvatar = signal<AvatarId>(this.auth.currentUser()?.avatar_id ?? 'terracotta');
  readonly photo = signal<string | null>(this.auth.currentUser()?.profile_photo ?? null);
  readonly saving = signal(false);
  readonly processing = signal(false);
  readonly cameraOpen = signal(false);
  readonly cameraStream = signal<MediaStream | null>(null);
  readonly cameraVideo = viewChild<ElementRef<HTMLVideoElement>>('cameraVideo');
  readonly error = signal('');
  readonly success = signal('');
  readonly imageChanged = computed(
    () =>
      this.photo() !== (this.auth.currentUser()?.profile_photo ?? null) ||
      this.selectedAvatar() !== (this.auth.currentUser()?.avatar_id ?? 'terracotta'),
  );
  readonly form = inject(FormBuilder).nonNullable.group({
    full_name: [
      this.auth.currentUser()?.full_name ?? '',
      [
        Validators.required,
        longitudMinimaSinEspacios(2),
        Validators.maxLength(100),
        sinEspaciosVaciosValidator(),
      ],
    ],
    email: [this.auth.currentUser()?.email ?? '', [Validators.required, Validators.email]],
  });

  private initialUserId: string | null = null;
  constructor() {
    effect(() => {
      const user = this.auth.currentUser();
      if (user && this.initialUserId !== user.id) {
        this.initialUserId = user.id;
        this.form.reset({ full_name: user.full_name, email: user.email });
        this.photo.set(user.profile_photo ?? null);
        this.selectedAvatar.set(user.avatar_id ?? 'terracotta');
      }
    });
    effect(() => {
      const video = this.cameraVideo()?.nativeElement;
      const stream = this.cameraStream();
      if (video && stream) {
        video.srcObject = stream;
        void video.play().catch(() => {});
      }
    });
    this.destroyRef.onDestroy(() => this.closeCamera());
  }

  storeBusy = signal(false);
  changeStore(selection: { tenant_id: string; branch_id: string }): void {
    if (this.storeBusy()) return;
    this.storeBusy.set(true);
    this.error.set('');
    this.success.set('');
    this.auth
      .selectStore(selection)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.storeBusy.set(false)),
      )
      .subscribe({
        next: () =>
          this.success.set('Tienda actualizada. Tu historial y comprobantes se conservan.'),
        error: (e) =>
          this.error.set(
            typeof e.error?.detail === 'string' ? e.error.detail : 'No se pudo cambiar de tienda.',
          ),
      });
  }

  async openCamera(): Promise<void> {
    if (this.saving() || this.processing() || this.cameraOpen()) return;
    this.error.set('');
    this.success.set('');
    if (!navigator.mediaDevices?.getUserMedia) {
      this.error.set(
        'La cámara necesita HTTPS o localhost y un navegador compatible. Puedes subir una foto de tu galería.',
      );
      return;
    }
    this.cameraOpen.set(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 512 }, height: { ideal: 512 } },
        audio: false,
      });
      if (this.destroyRef.destroyed || !this.cameraOpen()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.cameraStream.set(stream);
    } catch {
      if (!this.destroyRef.destroyed) {
        this.closeCamera();
        this.error.set('No se pudo acceder a la cámara. Revisa el permiso o sube una foto.');
      }
    }
  }

  closeCamera(): void {
    this.cameraStream()
      ?.getTracks()
      .forEach((track) => track.stop());
    this.cameraStream.set(null);
    this.cameraOpen.set(false);
  }

  capturePhoto(): void {
    const video = this.cameraVideo()?.nativeElement;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 512 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    this.photo.set(canvas.toDataURL('image/jpeg', 0.85));
    this.closeCamera();
  }

  chooseAvatar(id: AvatarId): void {
    if (this.saving() || this.processing() || this.cameraOpen()) return;
    this.selectedAvatar.set(id);
    this.photo.set(null);
    this.error.set('');
    this.success.set('');
  }

  async selectPhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.saving()) return;
    this.error.set('');
    this.success.set('');
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      this.error.set('Selecciona una imagen JPG, PNG o WebP de hasta 10 MB.');
      return;
    }
    this.processing.set(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (this.destroyRef.destroyed) return;
      const scale = Math.min(1, 512 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo preparar la foto.');
      context.fillStyle = '#FAF7F2';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      this.photo.set(canvas.toDataURL('image/jpeg', 0.85));
    } catch {
      if (!this.destroyRef.destroyed)
        this.error.set('No se pudo abrir la foto. Selecciona otra imagen.');
    } finally {
      URL.revokeObjectURL(url);
      this.processing.set(false);
    }
  }

  save(): void {
    if (this.saving() || this.processing() || this.cameraOpen()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.error.set('');
    this.success.set('');
    this.saving.set(true);
    const value = this.form.getRawValue();
    this.auth
      .updateProfile({
        full_name: value.full_name.trim(),
        email: value.email.trim(),
        avatar_id: this.selectedAvatar(),
        profile_photo: this.photo(),
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (user) => {
          this.photo.set(user.profile_photo ?? null);
          this.selectedAvatar.set(user.avatar_id ?? 'terracotta');
          this.form.reset({ full_name: user.full_name, email: user.email });
          this.success.set((user as any).sync_status === 'PENDING' ? 'Perfil guardado en este dispositivo. Pendiente de confirmar al recuperar conexión.' : 'Perfil actualizado.');
        },
        error: (error) =>
          this.error.set(
            typeof error.error?.detail === 'string'
              ? error.error.detail
              : 'No se pudo guardar el perfil. Revisa los datos e inténtalo de nuevo.',
          ),
      });
  }
}
