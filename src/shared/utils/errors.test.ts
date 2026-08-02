import { describe, it, expect, vi, afterEach } from 'vitest';
import { getErrorMessage, logError, handleError } from './errors';

describe('getErrorMessage', () => {
  it('returns the Error message when given a real Error', () => {
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
  });

  it('returns the fallback for a non-Error throw', () => {
    expect(getErrorMessage('some string', 'fallback')).toBe('fallback');
    expect(getErrorMessage(undefined, 'fallback')).toBe('fallback');
  });

  it('returns the fallback for an Error with an empty message', () => {
    expect(getErrorMessage(new Error(''), 'fallback')).toBe('fallback');
  });
});

describe('logError / handleError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs with the given context prefix', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('boom');
    logError('Sales.save', err);
    expect(spy).toHaveBeenCalledWith('[Sales.save]', err);
  });

  it('handleError logs and returns the message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const message = handleError('Sales.save', new Error('boom'), 'fallback');
    expect(message).toBe('boom');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
