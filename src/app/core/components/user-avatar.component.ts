import { Component, Input } from '@angular/core';
import { User } from '../models/user.model';

@Component({
  selector: 'app-user-avatar', standalone: true,
  template: `<img [src]="photo ?? user?.profile_photo ?? '/avatars/' + (avatarId ?? user?.avatar_id ?? 'terracotta') + '.png'"
    [alt]="'Imagen de perfil'" [style.width.px]="size" [style.height.px]="size" />`,
  styles: [`:host { display: inline-flex; flex-shrink: 0; } img { border-radius: 50%; object-fit: cover; border: 2px solid #fff; background: #DCE5DB; }`],
})
export class UserAvatarComponent {
  @Input() user: User | null = null;
  @Input() avatarId?: string;
  @Input() photo?: string | null;
  @Input() size = 40;
}
