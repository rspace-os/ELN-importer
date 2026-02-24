import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryManager } from './RetryManager';

describe('RetryManager', () => {
  let retryManager: RetryManager;

  beforeEach(() => {
    retryManager = new RetryManager();
    // Speed up tests by mocking sleep
    vi.spyOn(retryManager as any, 'sleep').mockResolvedValue(undefined);
  });

  it('executes successfully on the first attempt', async () => {
    const operation = vi.fn().mockResolvedValue('success');
    const result = await retryManager.executeWithRetry(operation);

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(result.attempts).toBe(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('fetch error'))
      .mockResolvedValue('success');
    
    // TypeError with fetch is retryable by default
    const error = new TypeError('fetch failed');
    operation.mockReset();
    operation
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success');

    const result = await retryManager.executeWithRetry(operation, { maxAttempts: 3 });

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(result.attempts).toBe(2);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('aborts after max attempts', async () => {
    const error = new TypeError('fetch failed');
    const operation = vi.fn().mockRejectedValue(error);

    const result = await retryManager.executeWithRetry(operation, { maxAttempts: 3 });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('does not retry on non-retryable errors (e.g., 404)', async () => {
    const error: any = new Error('Not Found');
    error.status = 404;
    const operation = vi.fn().mockRejectedValue(error);

    const result = await retryManager.executeWithRetry(operation);

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('returns success even with tiny timeout when first attempt resolves', async () => {
    const operation = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 10)));

    const result = await retryManager.executeWithRetry(operation, { timeoutMs: 1 });

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
  });
});
