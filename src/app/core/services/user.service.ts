import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  User,
  UserCreateAdmin,
  UserUpdateAdmin,
  UserFilters,
} from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly baseUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  getUsers(filters?: UserFilters): Observable<User[]> {
    let params = new HttpParams();

    if (filters) {
      if (filters.search) {
        params = params.set('search', filters.search);
      }
      if (filters.role) {
        params = params.set('role', filters.role);
      }
      if (filters.is_active !== undefined && filters.is_active !== null) {
        params = params.set('is_active', filters.is_active.toString());
      }
      if (filters.skip !== undefined) {
        params = params.set('skip', filters.skip.toString());
      }
      if (filters.limit !== undefined) {
        params = params.set('limit', filters.limit.toString());
      }
    }

    return this.http.get<User[]>(this.baseUrl, { params });
  }

  getUserById(id: string): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/${id}`);
  }

  createUser(payload: UserCreateAdmin): Observable<User> {
    return this.http.post<User>(this.baseUrl, payload);
  }

  updateUser(id: string, payload: UserUpdateAdmin): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/${id}`, payload);
  }

  toggleUserStatus(id: string): Observable<User> {
    return this.http.patch<User>(`${this.baseUrl}/${id}/toggle-status`, {});
  }
}
