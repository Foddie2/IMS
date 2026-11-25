import { AppUser, ROLE_LABELS } from '../models/auth.models';
import { ProfileRow } from '../models/supabase.models';

/** Maps a `profiles` row (+ the auth email) to the app user used for RBAC. */
export function mapProfile(profile: ProfileRow, email: string): AppUser {
  return {
    id: profile.id,
    name: profile.full_name || email,
    title: profile.title || ROLE_LABELS[profile.role],
    role: profile.role,
    siteIds: profile.site_ids ?? [],
  };
}

export function initialsOf(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
