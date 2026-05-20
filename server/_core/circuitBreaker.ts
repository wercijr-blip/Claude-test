/**
 * Simple in-process circuit breaker for external API calls.
 * States: closed (normal) → open (failing) → half-open (testing recovery).
 * After `resetMs` of being open, allows one request through (half-open).
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureAt = 0;
  private halfOpenAt = 0;

  constructor(
    readonly name: string,
    private readonly maxFailures = 3,
    private readonly resetMs = 60_000,
  ) {}

  isOpen(): boolean {
    if (this.failures < this.maxFailures) return false;
    if (Date.now() - this.lastFailureAt > this.resetMs) {
      this.failures = this.maxFailures - 1; // half-open: one trial request
      this.halfOpenAt = Date.now();
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.halfOpenAt = 0;
  }

  recordFailure(): void {
    this.failures++;
    // When a half-open trial fails, pin lastFailureAt to the moment we entered
    // half-open rather than now — prevents each failed trial from extending the
    // recovery window by the full trial duration.
    this.lastFailureAt = this.halfOpenAt > 0 ? this.halfOpenAt : Date.now();
    this.halfOpenAt = 0;
  }
}
