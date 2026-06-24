/**
 * Client-side password policy shared by the signup and change-password forms.
 *
 * This is the only password lever in this repo: the authoritative server-side
 * minimum is governed by the hosted Neon Auth project, not by code here. Keep
 * this aligned with (or below) the Neon-configured minimum.
 */
export const PASSWORD_MIN_LENGTH = 12;

/**
 * Returns a human-readable problem with the password/confirmation pair, or
 * `null` when they are acceptable. Length is checked before match so the most
 * actionable message wins when both are wrong.
 */
export function passwordProblem(password: string, confirm: string): string | null {
	if (password.length < PASSWORD_MIN_LENGTH)
		return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
	if (password !== confirm) return 'Passwords do not match.';
	return null;
}
