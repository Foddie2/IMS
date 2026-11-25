import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;

  /** An unsigned JWT that expires in an hour (the interceptor never verifies it). */
  const token = `h.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).replace(/=+$/, '')}.s`;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'login', children: [] }]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);

    const login = auth.login('admin@ims.com', 'Admin123!');
    backend.expectOne(`${environment.apiUrl}/auth/login`).flush({
      accessToken: token,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      user: { id: 1, fullName: 'Alex Morgan', email: 'admin@ims.com', role: 'SuperAdmin', assignedWarehouseIds: [] },
    });
    expect(await login).toBeNull();
  });

  afterEach(() => backend.verify());

  it('attaches the bearer token to API calls only', () => {
    http.get(`${environment.apiUrl}/products`).subscribe();
    http.get('https://example.com/other').subscribe();

    expect(backend.expectOne(`${environment.apiUrl}/products`).request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    expect(backend.expectOne('https://example.com/other').request.headers.has('Authorization')).toBe(false);
  });

  it('signs out when the API answers 401', () => {
    expect(auth.isAuthenticated()).toBe(true);
    http.get(`${environment.apiUrl}/inventory`).subscribe({ error: () => undefined });
    backend.expectOne(`${environment.apiUrl}/inventory`).flush({ title: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('ims.session')).toBeNull();
  });

  it('exposes role checks for the signed-in user', () => {
    expect(auth.hasRole(['Admin', 'SuperAdmin'])).toBe(true);
    expect(auth.hasRole(['User'])).toBe(false);
    expect(auth.can('users:manage')).toBe(true);
  });

  it('reports API error messages on failed sign-in', async () => {
    auth.logout();
    const login = auth.login('admin@ims.com', 'wrong');
    backend
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush({ title: 'Sign-in failed', detail: 'Incorrect email or password.' }, { status: 401, statusText: 'Unauthorized' });
    expect(await login).toBe('Incorrect email or password.');
  });
});
