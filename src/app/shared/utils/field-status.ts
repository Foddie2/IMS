/** The parts of a Signal Forms field state that templates use to show validation messages. */
export interface FieldStatus {
  touched(): boolean;
  invalid(): boolean;
  errors(): readonly { message?: string }[];
}

/** True once the user has interacted with an invalid field. */
export function showFieldError(state: FieldStatus): boolean {
  return state.touched() && state.invalid();
}

export function fieldErrorMessage(state: FieldStatus): string {
  return state.errors()[0]?.message ?? 'Invalid value.';
}
