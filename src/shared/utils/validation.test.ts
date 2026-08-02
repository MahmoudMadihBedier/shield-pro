import { describe, it, expect } from 'vitest';
import { FormValidator, FieldValidator, ValidationRules } from './validation';

function authValidator() {
  return new FormValidator()
    .addField('email', new FieldValidator()
      .addRule(ValidationRules.required('البريد الإلكتروني'))
      .addRule(ValidationRules.email()))
    .addField('password', new FieldValidator()
      .addRule(ValidationRules.required('كلمة المرور'))
      .addRule(ValidationRules.minLength(6, 'كلمة المرور')))
    .addField('name', new FieldValidator()
      .addRule(ValidationRules.required('الاسم'))
      .addRule(ValidationRules.minLength(3, 'الاسم')));
}

describe('FormValidator.validateForm', () => {
  it('passes a login submission that omits fields not part of that form (regression: previously always failed on the unsent `name` field)', () => {
    const result = authValidator().validateForm({ email: 'a@b.com', password: 'secret123' });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('still validates a signup submission that includes all registered fields', () => {
    const result = authValidator().validateForm({ email: 'a@b.com', password: 'secret123', name: 'A' });
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it('still catches an invalid value for a field that is present', () => {
    const result = authValidator().validateForm({ email: 'not-an-email', password: 'secret123' });
    expect(result.isValid).toBe(false);
    expect(result.errors.email).toBeDefined();
  });

  it('ignores data for fields with no registered validator', () => {
    const result = authValidator().validateForm({ email: 'a@b.com', password: 'secret123', extra: 'whatever' });
    expect(result.isValid).toBe(true);
  });
});
