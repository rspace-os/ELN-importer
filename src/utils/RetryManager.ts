/**
 * P1 IMPROVEMENT: Retry Manager with Exponential Backoff
 *
 * Provides intelligent retry logic for transient failures in network operations.
 * Uses exponential backoff with jitter to prevent thundering herd problems.
 */

export interface RetryOptions {
  maxAttempts?: number;        // Maximum number of retry attempts (default: 5)
  initialDelayMs?: number;     // Initial retry delay in ms (default: 1000)
  maxDelayMs?: number;         // Maximum retry delay in ms (default: 16000)
  timeoutMs?: number;          // Total timeout for all attempts (default: 60000)
  jitterFactor?: number;       // Jitter factor 0-1 (default: 0.1)
  shouldRetry?: (error: any) => boolean;  // Custom retry predicate
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTimeMs: number;
}

export class RetryManager {
  private defaultOptions: Required<RetryOptions> = {
    maxAttempts: 5,
    initialDelayMs: 1000,
    maxDelayMs: 16000,
    timeoutMs: 60000,
    jitterFactor: 0.1,
    shouldRetry: this.defaultShouldRetry.bind(this)
  };

  /**
   * Executes an async operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {},
    onRetry?: (attempt: number, delayMs: number, error: any) => void
  ): Promise<RetryResult<T>> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    let lastError: any;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime >= opts.timeoutMs) {
        console.error(`RetryManager: Timeout after ${elapsedTime}ms (${attempt - 1} attempts)`);
        return {
          success: false,
          error: new Error(`Operation timed out after ${elapsedTime}ms`),
          attempts: attempt - 1,
          totalTimeMs: elapsedTime
        };
      }

      try {
        console.log(`RetryManager: Attempt ${attempt}/${opts.maxAttempts}`);
        const result = await operation();
        const totalTime = Date.now() - startTime;

        if (attempt > 1) {
          console.log(`RetryManager: Success after ${attempt} attempts (${totalTime}ms total)`);
        }

        return {
          success: true,
          result,
          attempts: attempt,
          totalTimeMs: totalTime
        };
      } catch (error) {
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`RetryManager: Attempt ${attempt} failed:`, errorMessage);

        if (!opts.shouldRetry(error)) {
          console.error('RetryManager: Error is not retryable, aborting');
          return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
            attempts: attempt,
            totalTimeMs: Date.now() - startTime
          };
        }

        if (attempt < opts.maxAttempts) {
          const delayMs = this.calculateDelay(attempt, opts);
          console.log(`RetryManager: Retrying in ${delayMs}ms...`);

          if (onRetry) {
            onRetry(attempt, delayMs, error);
          }

          await this.sleep(delayMs);
        }
      }
    }

    const totalTime = Date.now() - startTime;
    console.error(`RetryManager: All ${opts.maxAttempts} attempts failed (${totalTime}ms total)`);

    return {
      success: false,
      error: lastError instanceof Error ? lastError : new Error(String(lastError)),
      attempts: opts.maxAttempts,
      totalTimeMs: totalTime
    };
  }

  private calculateDelay(attempt: number, options: Required<RetryOptions>): number {
    const exponentialDelay = options.initialDelayMs * Math.pow(2, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs);
    const jitterRange = cappedDelay * options.jitterFactor;
    const jitter = (Math.random() * 2 - 1) * jitterRange;
    const finalDelay = Math.max(0, cappedDelay + jitter);
    return Math.round(finalDelay);
  }

  private defaultShouldRetry(error: any): boolean {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.log('RetryManager: Network error detected - retryable');
      return true;
    }

    if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
      console.log('RetryManager: Timeout error detected - retryable');
      return true;
    }

    if (error.message?.includes('connection') || error.message?.includes('ECONNRESET')) {
      console.log('RetryManager: Connection error detected - retryable');
      return true;
    }

    if (error.response || error.status) {
      const status = error.response?.status || error.status;

      const retryableStatuses = [429, 502, 503, 504];
      if (retryableStatuses.includes(status)) {
        console.log(`RetryManager: HTTP ${status} detected - retryable`);
        return true;
      }

      const nonRetryableStatuses = [400, 401, 403, 404, 409, 422];
      if (nonRetryableStatuses.includes(status)) {
        console.log(`RetryManager: HTTP ${status} detected - not retryable`);
        return false;
      }

      if (status >= 500 && status < 600) {
        console.log(`RetryManager: HTTP ${status} detected - retryable (5xx)`);
        return true;
      }
    }

    console.log('RetryManager: Unknown error type - not retryable');
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static createStatusRetryPredicate(retryableStatuses: number[]): (error: any) => boolean {
    return (error: any) => {
      const status = error.response?.status || error.status;
      return status && retryableStatuses.includes(status);
    };
  }

  static combineRetryPredicates(...predicates: Array<(error: any) => boolean>): (error: any) => boolean {
    return (error: any) => {
      for (const predicate of predicates) {
        if (predicate(error)) {
          return true;
        }
      }
      return false;
    };
  }
}

export async function retryAsync<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 5
): Promise<T> {
  const manager = new RetryManager();
  const result = await manager.executeWithRetry(operation, { maxAttempts });

  if (result.success) {
    return result.result!;
  } else {
    throw result.error!;
  }
}
