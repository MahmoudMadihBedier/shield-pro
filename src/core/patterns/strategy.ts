// Strategy Pattern - Defines a family of algorithms and makes them interchangeable

export interface SyncStrategy {
  sync(): Promise<void>;
  canSync(): boolean;
  getPriority(): number;
}

export class OnlineSyncStrategy implements SyncStrategy {
  async sync(): Promise<void> {
    // Implementation for online sync
    console.log('Executing online sync strategy');
  }

  canSync(): boolean {
    return navigator.onLine;
  }

  getPriority(): number {
    return 1; // Highest priority
  }
}

export class OfflineSyncStrategy implements SyncStrategy {
  async sync(): Promise<void> {
    // Implementation for offline sync (queue operations)
    console.log('Executing offline sync strategy');
  }

  canSync(): boolean {
    return true; // Always available
  }

  getPriority(): number {
    return 2; // Lower priority
  }
}

export class BatchSyncStrategy implements SyncStrategy {
  async sync(): Promise<void> {
    // Implementation for batch sync
    console.log('Executing batch sync strategy');
  }

  canSync(): boolean {
    return navigator.onLine;
  }

  getPriority(): number {
    return 3; // Lowest priority
  }
}

export class SyncContext {
  private strategies: SyncStrategy[] = [];

  addStrategy(strategy: SyncStrategy): void {
    this.strategies.push(strategy);
    this.strategies.sort((a, b) => a.getPriority() - b.getPriority());
  }

  async executeSync(): Promise<void> {
    for (const strategy of this.strategies) {
      if (strategy.canSync()) {
        await strategy.sync();
        break; // Use first available strategy
      }
    }
    throw new Error('No sync strategy available');
  }
}

// Another strategy example: Data Validation
export interface ValidationStrategy {
  validate(data: any): boolean;
  getErrorMessage(): string;
}

export class EmailValidationStrategy implements ValidationStrategy {
  validate(data: any): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(data);
  }

  getErrorMessage(): string {
    return 'Invalid email format';
  }
}

export class PhoneValidationStrategy implements ValidationStrategy {
  validate(data: any): boolean {
    const phoneRegex = /^\+?[\d\s-]{10,}$/;
    return phoneRegex.test(data);
  }

  getErrorMessage(): string {
    return 'Invalid phone number format';
  }
}

export class ValidationContext {
  private strategies: ValidationStrategy[] = [];

  addStrategy(strategy: ValidationStrategy): void {
    this.strategies.push(strategy);
  }

  validate(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    for (const strategy of this.strategies) {
      if (!strategy.validate(data)) {
        errors.push(strategy.getErrorMessage());
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}