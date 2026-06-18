import { describe, it, expect } from 'vitest';
import { PASSWORD_MIN_LENGTH, passwordProblem } from './password';

describe('PASSWORD_MIN_LENGTH', () => {
	it('is 12', () => {
		expect(PASSWORD_MIN_LENGTH).toBe(12);
	});
});

describe('passwordProblem', () => {
	it('returns null when the password meets the minimum and matches its confirmation', () => {
		expect(passwordProblem('correct-horse', 'correct-horse')).toBeNull();
	});

	it('accepts a password of exactly the minimum length', () => {
		const pw = 'a'.repeat(PASSWORD_MIN_LENGTH);
		expect(passwordProblem(pw, pw)).toBeNull();
	});

	it('flags a password shorter than the minimum', () => {
		expect(passwordProblem('short', 'short')).toBe(
			`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
		);
	});

	it('flags an empty password as too short rather than mismatched', () => {
		expect(passwordProblem('', '')).toBe(
			`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
		);
	});

	it('reports length before mismatch when both are wrong', () => {
		expect(passwordProblem('short', 'other')).toBe(
			`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
		);
	});

	it('flags a confirmation that does not match a long-enough password', () => {
		expect(passwordProblem('correct-horse', 'correct-horsey')).toBe('Passwords do not match.');
	});
});
