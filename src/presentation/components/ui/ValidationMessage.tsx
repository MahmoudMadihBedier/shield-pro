import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface ValidationMessageProps {
  message?: string;
  isValid?: boolean;
  show?: boolean;
}

// Validation Message Component (SRP - Single Responsibility Principle)
export const ValidationMessage: React.FC<ValidationMessageProps> = ({
  message,
  isValid = true,
  show = true,
}) => {
  if (!show || !message) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className={`flex items-center gap-2 text-xs mt-1 ${
          isValid ? 'text-green-600' : 'text-red-600'
        }`}
      >
        {isValid ? (
          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        )}
        <span>{message}</span>
      </motion.div>
    </AnimatePresence>
  );
};

// Form Field Wrapper Component (SRP - Single Responsibility Principle)
interface FormFieldProps {
  label?: string;
  error?: string;
  isValid?: boolean;
  required?: boolean;
  children: React.ReactNode;
  helpText?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  isValid = true,
  required = false,
  children,
  helpText,
}) => {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-xs font-bold text-gray-600 mb-1">
          {label}
          {required && <span className="text-red-500 mr-1">*</span>}
        </label>
      )}
      <div className={error ? 'animate-shake' : ''}>
        {children}
      </div>
      <ValidationMessage message={error} isValid={isValid} show={!!error} />
      {helpText && !error && (
        <p className="text-xs text-gray-500 mt-1">{helpText}</p>
      )}
    </div>
  );
};