import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ProblemDetails } from '../models/api.models';

/** Turns an API failure (RFC 7807 problem details) into a sentence suitable for the UI. */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }
  if (error.status === 0) {
    return `Cannot reach the IMS API at ${environment.apiUrl}. Is the backend running?`;
  }
  if (error.status === 429) {
    return 'Too many attempts. Please wait a minute and try again.';
  }

  const problem = (error.error ?? {}) as ProblemDetails;
  if (problem.errors) {
    const messages = Object.values(problem.errors).flat();
    if (messages.length) return messages.join(' ');
  }
  if (problem.detail) return problem.detail;
  if (problem.title) return problem.title;
  if (error.status === 403) return 'You do not have permission to do that.';
  if (error.status === 404) return 'Not found.';
  return fallback;
}
