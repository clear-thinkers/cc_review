/**
 * Login & Session Authentication Service
 * 
 * Handles PIN hashing, session token management, and login state persistence.
 * All operations are client-side using localStorage.
 */

/**
 * Hash a 4-digit PIN using SHA-256 (client-side)
 * @param pin - 4-digit PIN as string (e.g., "1234")
 * @returns Promise<string> - Hex-encoded SHA-256 hash
 */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Verify a PIN against a stored hash
 * @param pin - 4-digit PIN as string
 * @param storedHash - Previously hashed PIN
 * @returns Promise<boolean> - True if PIN matches stored hash
 */
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  const inputHash = await hashPin(pin);
  return inputHash === storedHash;
}

/**
 * Create an opaque session token
 * @returns string - Unique session token
 */
export function createSessionToken(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 14);
  return `sessionToken_${timestamp}_${random}`;
}

/**
 * Session data structure
 */
export interface LoginSession {
  sessionToken: string;
  selectedAvatarId: number;
  createdAt: number;
}

/**
 * Get session data from localStorage
 * @returns LoginSession | null
 */
export function getSessionData(): LoginSession | null {
  try {
    const token = localStorage.getItem('sessionToken');
    const avatarId = localStorage.getItem('selectedAvatarId');
    const createdAt = localStorage.getItem('sessionCreatedAt');

    if (!token || avatarId === null || !createdAt) {
      return null;
    }

    return {
      sessionToken: token,
      selectedAvatarId: parseInt(avatarId, 10),
      createdAt: parseInt(createdAt, 10),
    };
  } catch (e) {
    console.error('Failed to read session data:', e);
    return null;
  }
}

/**
 * Set session data in localStorage
 * @param token - Session token
 * @param avatarId - Selected avatar ID (0-2)
 */
export function setSessionData(token: string, avatarId: number): void {
  try {
    localStorage.setItem('sessionToken', token);
    localStorage.setItem('selectedAvatarId', String(avatarId));
    localStorage.setItem('sessionCreatedAt', String(Date.now()));
  } catch (e) {
    console.error('Failed to set session data:', e);
  }
}

/**
 * Clear all session data from localStorage
 */
export function clearSessionData(): void {
  try {
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('selectedAvatarId');
    localStorage.removeItem('sessionCreatedAt');
  } catch (e) {
    console.error('Failed to clear session data:', e);
  }
}

/**
 * Get stored PIN hash from localStorage
 * @returns string | null - SHA-256 hash of PIN, or null if not set
 */
export function getPinHash(): string | null {
  try {
    return localStorage.getItem('storedPinHash');
  } catch (e) {
    console.error('Failed to read PIN hash:', e);
    return null;
  }
}

/**
 * Set PIN hash in localStorage
 * @param hash - SHA-256 hash of PIN
 */
export function setPinHash(hash: string): void {
  try {
    localStorage.setItem('storedPinHash', hash);
  } catch (e) {
    console.error('Failed to set PIN hash:', e);
  }
}

/**
 * Get last selected avatar ID (for UX convenience)
 * @returns number | null - Avatar ID or null
 */
export function getLastSelectedAvatarId(): number | null {
  try {
    const id = localStorage.getItem('lastSelectedAvatarId');
    return id ? parseInt(id, 10) : null;
  } catch (e) {
    console.error('Failed to read last avatar ID:', e);
    return null;
  }
}

/**
 * Store last selected avatar ID for next login
 * @param avatarId - Avatar ID (0-2)
 */
export function setLastSelectedAvatarId(avatarId: number): void {
  try {
    localStorage.setItem('lastSelectedAvatarId', String(avatarId));
  } catch (e) {
    console.error('Failed to set last avatar ID:', e);
  }
}

/**
 * Check if user has a PIN set (indicates returning user)
 * @returns boolean - True if PIN hash exists in localStorage
 */
export function hasPinSet(): boolean {
  return getPinHash() !== null;
}

/**
 * Clear all auth data (PIN hash + session) for full logout
 */
export function clearAllAuthData(): void {
  try {
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('selectedAvatarId');
    localStorage.removeItem('sessionCreatedAt');
    localStorage.removeItem('storedPinHash');
    localStorage.removeItem('lastSelectedAvatarId');
  } catch (e) {
    console.error('Failed to clear all auth data:', e);
  }
}
