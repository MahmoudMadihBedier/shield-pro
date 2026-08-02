// Validation Rule Interface (ISP - Interface Segregation Principle)
export interface ValidationRule {
  validate: (value: any) => boolean;
  message: string;
}

// Validator Interface (DIP - Dependency Inversion Principle)
export interface IValidator {
  validate: (value: any) => { isValid: boolean; message?: string };
}

// Common Validation Rules (SRP - Single Responsibility Principle)
export const ValidationRules = {
  required: (fieldName?: string): ValidationRule => ({
    validate: (value) => value !== null && value !== undefined && value !== '',
    message: fieldName ? `${fieldName} مطلوب` : 'هذا الحقل مطلوب',
  }),

  email: (): ValidationRule => ({
    validate: (value) => {
      if (!value) return true;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    },
    message: 'يرجى إدخال بريد إلكتروني صحيح',
  }),

  minLength: (min: number, fieldName?: string): ValidationRule => ({
    validate: (value) => !value || value.length >= min,
    message: fieldName ? `${fieldName} يجب أن يكون ${min} أحرف على الأقل` : `يجب أن يكون ${min} أحرف على الأقل`,
  }),

  maxLength: (max: number, fieldName?: string): ValidationRule => ({
    validate: (value) => !value || value.length <= max,
    message: fieldName ? `${fieldName} يجب أن لا يتجاوز ${max} أحرف` : `يجب أن لا يتجاوز ${max} أحرف`,
  }),

  numeric: (fieldName?: string): ValidationRule => ({
    validate: (value) => !value || !isNaN(Number(value)),
    message: fieldName ? `${fieldName} يجب أن يكون رقماً` : 'يجب أن يكون رقماً',
  }),

  positiveNumber: (fieldName?: string): ValidationRule => ({
    validate: (value) => !value || Number(value) > 0,
    message: fieldName ? `${fieldName} يجب أن يكون رقماً موجباً` : 'يجب أن يكون رقماً موجباً',
  }),

  phone: (): ValidationRule => ({
    validate: (value) => {
      if (!value) return true;
      const phoneRegex = /^01[0-2]\d{8}$/;
      return phoneRegex.test(value.replace(/\s/g, ''));
    },
    message: 'يرجى إدخال رقم هاتف صحيح (01xxxxxxxxx)',
  }),

  min: (min: number, fieldName?: string): ValidationRule => ({
    validate: (value) => !value || Number(value) >= min,
    message: fieldName ? `${fieldName} يجب أن يكون ${min} على الأقل` : `يجب أن يكون ${min} على الأقل`,
  }),

  max: (max: number, fieldName?: string): ValidationRule => ({
    validate: (value) => !value || Number(value) <= max,
    message: fieldName ? `${fieldName} يجب أن لا يتجاوز ${max}` : `يجب أن لا يتجاوز ${max}`,
  }),

  pattern: (regex: RegExp, message: string): ValidationRule => ({
    validate: (value) => !value || regex.test(value),
    message,
  }),
};

// Field Validator Class (SRP - Single Responsibility Principle)
export class FieldValidator implements IValidator {
  private rules: ValidationRule[] = [];

  constructor() {}

  addRule(rule: ValidationRule): this {
    this.rules.push(rule);
    return this;
  }

  validate(value: any): { isValid: boolean; message?: string } {
    for (const rule of this.rules) {
      if (!rule.validate(value)) {
        return { isValid: false, message: rule.message };
      }
    }
    return { isValid: true };
  }
}

// Form Validator Class (SRP - Single Responsibility Principle)
export class FormValidator {
  private validators: Map<string, FieldValidator> = new Map();

  addField(fieldName: string, validator: FieldValidator): this {
    this.validators.set(fieldName, validator);
    return this;
  }

  validateField(fieldName: string, value: any): { isValid: boolean; message?: string } {
    const validator = this.validators.get(fieldName);
    if (!validator) {
      return { isValid: true };
    }
    return validator.validate(value);
  }

  validateForm(data: Record<string, any>): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    let isValid = true;

    // Only validate fields actually present in the submitted data — a
    // validator can have fields registered for a form shape it doesn't
    // always see in full (e.g. an auth validator shared between a login
    // form with no `name` field and a signup form that has one).
    for (const fieldName of Object.keys(data)) {
      const validator = this.validators.get(fieldName);
      if (!validator) continue;
      const result = validator.validate(data[fieldName]);
      if (!result.isValid) {
        errors[fieldName] = result.message || '';
        isValid = false;
      }
    }

    return { isValid, errors };
  }
}

// Helper function to create common field validators
export const createFieldValidator = (rules: Array<(fieldName?: string) => ValidationRule>) => {
  const validator = new FieldValidator();
  rules.forEach((ruleFn) => validator.addRule(ruleFn()));
  return validator;
};