import { describe, it, expect } from 'vitest';
import { isAuthorizedCron } from './cron-auth';

describe('isAuthorizedCron', () => {
	it('fails closed (503) when the secret is unset or empty', () => {
		expect(isAuthorizedCron('Bearer x', undefined)).toEqual({ authorized: false, status: 503 });
		expect(isAuthorizedCron('Bearer x', '')).toEqual({ authorized: false, status: 503 });
	});

	it('rejects a missing or mismatched bearer (401)', () => {
		expect(isAuthorizedCron(null, 's3cret')).toEqual({ authorized: false, status: 401 });
		expect(isAuthorizedCron('Bearer wrong', 's3cret')).toEqual({ authorized: false, status: 401 });
		expect(isAuthorizedCron('s3cret', 's3cret')).toEqual({ authorized: false, status: 401 });
	});

	it('authorizes an exact Bearer match', () => {
		expect(isAuthorizedCron('Bearer s3cret', 's3cret')).toEqual({ authorized: true });
	});
});
