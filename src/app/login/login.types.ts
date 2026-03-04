/**
 * Login & Avatar Feature Types
 */

export interface AvatarOption {
  id: number; // 0-2
  filename: string; // e.g., "bubble_tea", "cake", "donut"
  label: string; // Display label (user-facing)
}

export interface LoginPageState {
  step: 'pin' | 'avatar'; // Current step in login flow
  pin: string; // User's PIN input (for validation checks)
  selectedAvatarId: number | null; // Selected avatar (0-2)
  error: string | null; // Error message to display
  isSubmitting: boolean; // Prevent double-submit
}

export interface LoginContextType {
  sessionToken: string | null;
  selectedAvatarId: number | null;
  isLoggedIn: boolean;
  logout(): Promise<void>;
}
