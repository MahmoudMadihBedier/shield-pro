import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../application/services/auth-service';
import { Lock, Mail, User, ShieldCheck } from 'lucide-react';
import { useToast } from './ui/Toast';
import { FormField } from './ui/ValidationMessage';
import { AnimatedContainer } from './ui/animations/AnimatedContainer';
import { CardAnimation } from './ui/animations/CardAnimation';
import { useFormValidation, createAuthValidator } from '../../application/hooks/use-form-validation';

export const Auth: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const { success, error } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  
  const validator = createAuthValidator();
  const { validations, validateField, validateForm, touchField, resetValidations } = useFormValidation(validator);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const formData = { email, password, ...(isSignUp ? { name } : {}) };
    const isValid = validateForm(formData);
    
    if (!isValid) {
      error('يرجى تصحيح الأخطاء في النموذج');
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password, name);
        success('تم إنشاء الحساب بنجاح! يرجى التحقق من بريدك الإلكتروني لتأكيد التسجيل، ثم تسجيل الدخول.');
        setIsSignUp(false);
        setName('');
        setEmail('');
        setPassword('');
        resetValidations();
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      error(err.message || 'فشلت العملية، يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8" dir="rtl">
      <AnimatedContainer variant="fadeIn" className="sm:mx-auto sm:w-full sm:max-w-md">
        <div>
          <AnimatedContainer variant="scaleIn" delay={0.1}>
            <div className="flex justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <ShieldCheck className="h-16 w-16 text-blue-600" />
              </motion.div>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              نظام شيلد برو لإدارة الموارد (ERP)
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              شركة تصنيع لواصق الإطارات الفورية والختم الذكي
            </p>
          </AnimatedContainer>
        </div>
      </AnimatedContainer>

      <CardAnimation className="mt-8 sm:mx-auto sm:w-full sm:max-w-md" delay={0.2}>
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
          <h3 className="mb-6 text-xl font-bold text-gray-800 text-center">
            {isSignUp ? 'إنشاء حساب جديد للموظف' : 'تسجيل الدخول الموحد'}
          </h3>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {isSignUp && (
              <FormField
                label="الاسم الكامل"
                error={validations.name?.message}
                isValid={validations.name?.isValid}
                required
                helpText="أدخل اسمك الكامل كما يظهر في الوثائق الرسمية"
              >
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      validateField('name', e.target.value);
                    }}
                    onBlur={() => touchField('name')}
                    className={`block w-full pr-10 border rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm text-right ${
                      validations.name?.touched && !validations.name?.isValid
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300'
                    }`}
                    placeholder="محمد أحمد"
                  />
                </div>
              </FormField>
            )}

            <FormField
              label="البريد الإلكتروني"
              error={validations.email?.message}
              isValid={validations.email?.isValid}
              required
              helpText="استخدم بريدك الإلكتروني الرسمي للعمل"
            >
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    validateField('email', e.target.value);
                  }}
                  onBlur={() => touchField('email')}
                  className={`block w-full pr-10 border rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm text-right LTR-input ${
                    validations.email?.touched && !validations.email?.isValid
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300'
                  }`}
                  placeholder="admin@shieldpro.com"
                />
              </div>
            </FormField>

            <FormField
              label="كلمة المرور"
              error={validations.password?.message}
              isValid={validations.password?.isValid}
              required
              helpText="كلمة المرور يجب أن تكون 6 أحرف على الأقل"
            >
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    validateField('password', e.target.value);
                  }}
                  onBlur={() => touchField('password')}
                  className={`block w-full pr-10 border rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm text-right ${
                    validations.password?.touched && !validations.password?.isValid
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300'
                  }`}
                  placeholder="••••••••"
                />
              </div>
            </FormField>

            <div>
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                    />
                    جاري التحميل...
                  </span>
                ) : isSignUp ? 'إنشاء الحساب' : 'دخول'}
              </motion.button>
            </div>
          </form>

          <div className="mt-6 flex items-center justify-center">
            <motion.button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                resetValidations();
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="text-sm text-blue-600 hover:text-blue-500 font-medium transition-colors"
            >
              {isSignUp ? 'لديك حساب بالفعل؟ سجل الدخول هنا' : 'ليس لديك حساب؟ قم بإنشاء حساب جديد'}
            </motion.button>
          </div>
        </div>
      </CardAnimation>
    </div>
  );
};
