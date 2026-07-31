import { useState, useCallback } from 'react';
import { FormValidator, FieldValidator, ValidationRules } from '../../shared/utils/validation';

export interface FieldValidation {
  isValid: boolean;
  message?: string;
  touched: boolean;
}

export interface UseFormValidationReturn {
  validations: Record<string, FieldValidation>;
  validateField: (fieldName: string, value: any) => boolean;
  validateForm: (data: Record<string, any>) => boolean;
  touchField: (fieldName: string) => void;
  resetValidations: () => void;
  isFormValid: boolean;
}

// Custom hook for form validation (SRP - Single Responsibility Principle)
export const useFormValidation = (
  validator: FormValidator
): UseFormValidationReturn => {
  const [validations, setValidations] = useState<Record<string, FieldValidation>>({});

  const validateField = useCallback(
    (fieldName: string, value: any): boolean => {
      const result = validator.validateField(fieldName, value);
      setValidations((prev) => ({
        ...prev,
        [fieldName]: {
          isValid: result.isValid,
          message: result.message,
          touched: prev[fieldName]?.touched || false,
        },
      }));
      return result.isValid;
    },
    [validator]
  );

  const validateForm = useCallback(
    (data: Record<string, any>): boolean => {
      const result = validator.validateForm(data);
      
      const newValidations: Record<string, FieldValidation> = {};
      for (const [fieldName, message] of Object.entries(result.errors)) {
        newValidations[fieldName] = {
          isValid: false,
          message,
          touched: true,
        };
      }
      
      // Mark all fields as valid if no errors
      if (result.isValid) {
        Object.keys(data).forEach((fieldName) => {
          newValidations[fieldName] = {
            isValid: true,
            touched: true,
          };
        });
      }
      
      setValidations(newValidations);
      return result.isValid;
    },
    [validator]
  );

  const touchField = useCallback((fieldName: string) => {
    setValidations((prev) => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        touched: true,
      },
    }));
  }, []);

  const resetValidations = useCallback(() => {
    setValidations({});
  }, []);

  const isFormValid = Object.values(validations).every(
    (v) => v.isValid || !v.touched
  );

  return {
    validations,
    validateField,
    validateForm,
    touchField,
    resetValidations,
    isFormValid,
  };
};

// Pre-built validators for common forms
export const createAuthValidator = () => {
  const validator = new FormValidator();
  
  validator.addField('email', new FieldValidator()
    .addRule(ValidationRules.required('البريد الإلكتروني'))
    .addRule(ValidationRules.email()));
  
  validator.addField('password', new FieldValidator()
    .addRule(ValidationRules.required('كلمة المرور'))
    .addRule(ValidationRules.minLength(6, 'كلمة المرور')));
  
  validator.addField('name', new FieldValidator()
    .addRule(ValidationRules.required('الاسم'))
    .addRule(ValidationRules.minLength(3, 'الاسم')));
  
  return validator;
};

export const createCustomerValidator = () => {
  const validator = new FormValidator();
  
  validator.addField('name', new FieldValidator()
    .addRule(ValidationRules.required('الاسم'))
    .addRule(ValidationRules.minLength(3, 'الاسم')));
  
  validator.addField('phone', new FieldValidator()
    .addRule(ValidationRules.phone()));
  
  validator.addField('opening_balance', new FieldValidator()
    .addRule(ValidationRules.numeric('الرصيد الافتتاحي'))
    .addRule(ValidationRules.min(0, 'الرصيد الافتتاحي')));
  
  return validator;
};

export const createInvoiceValidator = () => {
  const validator = new FormValidator();
  
  validator.addField('customer', new FieldValidator()
    .addRule(ValidationRules.required('العميل')));
  
  validator.addField('warehouse', new FieldValidator()
    .addRule(ValidationRules.required('المخزن')));
  
  validator.addField('payment_method', new FieldValidator()
    .addRule(ValidationRules.required('طريقة السداد')));
  
  return validator;
};