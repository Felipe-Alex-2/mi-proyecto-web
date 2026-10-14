import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { ProfileComponent } from './profile.component';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';

describe('Profile editor', () => {
  const user = { id: '1', full_name: 'Cliente VESTA', email: 'cliente@example.com', avatar_id: 'terracotta', profile_photo: 'data:image/jpeg;base64,dGVzdA==' } as User;
  let response: Subject<User>;
  let auth: { currentUser: ReturnType<typeof signal<User | null>>; updateProfile: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    response = new Subject<User>();
    auth = { currentUser: signal<User | null>(user), updateProfile: vi.fn(() => response) };
    TestBed.configureTestingModule({ imports: [ProfileComponent], providers: [{ provide: AuthService, useValue: auth }] });
  });

  it('rejects empty and padded one-character names before sending requests', () => {
    const fixture = TestBed.createComponent(ProfileComponent); fixture.detectChanges();
    for (const name of ['', '   ', ' a ']) {
      fixture.componentInstance.form.controls.full_name.setValue(name);
      fixture.componentInstance.save();
    }
    expect(auth.updateProfile).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('persists an avatar, clears the previous photo, and prevents double submission', () => {
    const fixture = TestBed.createComponent(ProfileComponent); fixture.detectChanges();
    const component = fixture.componentInstance;
    component.chooseAvatar('sage'); component.save(); component.save();
    expect(auth.updateProfile).toHaveBeenCalledTimes(1);
    expect(auth.updateProfile).toHaveBeenCalledWith({ full_name: user.full_name, email: user.email, avatar_id: 'sage', profile_photo: null });
    const updated = { ...user, avatar_id: 'sage', profile_photo: null } as User;
    auth.currentUser.set(updated); response.next(updated); response.complete();
    expect(component.saving()).toBe(false);
    expect(component.success()).toBe('Perfil actualizado.');
    fixture.destroy();
  });

  it('stops the camera stream when the editor is destroyed', async () => {
    const previous = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
    const stop = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) } });
    const fixture = TestBed.createComponent(ProfileComponent); fixture.detectChanges();
    await fixture.componentInstance.openCamera();
    fixture.destroy();
    expect(stop).toHaveBeenCalledOnce();
    if (previous) Object.defineProperty(navigator, 'mediaDevices', previous);
    else Reflect.deleteProperty(navigator, 'mediaDevices');
  });
});
