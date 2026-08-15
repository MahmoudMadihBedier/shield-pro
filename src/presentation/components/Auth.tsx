import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../application/services/auth-service';
import { Lock, Mail, User, ShieldCheck, Users, ShoppingCart, ArrowRight, Copy, Check } from 'lucide-react';
import { useToast } from './ui/Toast';
import { FormField } from './ui/ValidationMessage';
import { AnimatedContainer } from './ui/animations/AnimatedContainer';
import { CardAnimation } from './ui/animations/CardAnimation';
import { useFormValidation, createAuthValidator } from '../../application/hooks/use-form-validation';

type UserType = 'employee' | 'client';

export const Auth: React.FC = () => {
  const { signIn, signUp, signInClient, registerClient } = useAuth();
  const { success, error } = useToast();
  const [userType, setUserType] = useState<UserType | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedClientId, setCopiedClientId] = useState(false);
  
  const validator = createAuthValidator();
  const { validations, validateField, validateForm, touchField, resetValidations } = useFormValidation(validator);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (userType === 'client') {
      // Client authentication flow
      if (isSignUp) {
        // Client registration with client ID
        if (!clientId.trim()) {
          error('يرجى إدخال معرف العميل');
          return;
        }
        
        setLoading(true);
        try {
          const result = await registerClient(clientId, email, password, name);
          if (result.success) {
            success('تم إنشاء حساب العميل بنجاح! يمكنك الآن تسجيل الدخول.');
            setIsSignUp(false);
            setClientId('');
            setEmail('');
            setPassword('');
            setName('');
            resetValidations();
          } else {
            error(result.error || 'فشل إنشاء حساب العميل');
          }
        } catch (err: any) {
          error(err.message || 'فشل إنشاء حساب العميل');
        } finally {
          setLoading(false);
        }
      } else {
        // Client login with client ID
        if (!clientId.trim()) {
          error('يرجى إدخال معرف العميل');
          return;
        }
        
        setLoading(true);
        try {
          await signInClient(clientId, email, password);
          success('تم تسجيل الدخول بنجاح!');
        } catch (err: any) {
          error(err.message || 'فشل تسجيل الدخول');
        } finally {
          setLoading(false);
        }
      }
    } else {
      // Employee authentication flow (existing logic)
      const formData = { email, password, ...(isSignUp ? { name } : {}) };
      const isValid = validateForm(formData);
      
      if (!isValid) {
        error('يرجى تصحيح الأخطاء في النموذج');
        return;
      }

      setLoading(true);

      try {
        if (isSignUp) {
          const needsConfirmation = await signUp(email, password, name);
          
          if (needsConfirmation) {
            success('تم إنشاء الحساب بنجاح! يرجى التحقق من بريدك الإلكتروني لتأكيد التسجيل، ثم تسجيل الدخول.');
            setIsSignUp(false);
            setName('');
            setEmail('');
            setPassword('');
            resetValidations();
          } else {
            success('تم إنشاء الحساب بنجاح وتسجيل الدخول تلقائياً!');
            setName('');
            setEmail('');
            setPassword('');
            resetValidations();
          }
        } else {
          await signIn(email, password);
          success('تم تسجيل الدخول بنجاح!');
        }
      } catch (err: any) {
        let errorMessage = err.message || 'فشلت العملية، يرجى المحاولة مرة أخرى.';
        
        if (errorMessage.includes('504') || errorMessage.includes('timeout') || errorMessage.includes('المصادقة يستجيب ببطء')) {
          errorMessage += '\n\nيمكنك:\n1. المحاولة مرة أخرى بعد دقيقة\n2. التحقق من حالة خدمة Supabase: https://status.supabase.com\n3. تعطيل تأكيد البريد الإلكتروني في إعدادات Supabase';
        }
        
        error(errorMessage);
      } finally {
        setLoading(false);
      }
    }
  };

  const copyClientId = () => {
    navigator.clipboard.writeText(clientId);
    setCopiedClientId(true);
    setTimeout(() => setCopiedClientId(false), 2000);
    success('تم نسخ معرف العميل');
  };

  const shareClientIdOnWhatsApp = () => {
    const message = `معرف العميل الخاص بك: ${clientId}\nاستخدم هذا المعرف لتسجيل الدخول إلى بوابة العملاء`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const resetForm = () => {
    setUserType(null);
    setIsSignUp(false);
    setEmail('');
    setPassword('');
    setName('');
    setClientId('');
    resetValidations();
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
          
          {/* User Type Selection */}
          {!userType && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-800 text-center">
                اختر نوع المستخدم
              </h3>
              <p className="text-sm text-gray-600 text-center">
                اختر نوع المستخدم للمتابعة بتسجيل الدخول
              </p>
              
              <div className="space-y-4">
                <motion.button
                  onClick={() => setUserType('employee')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                  <div className="bg-blue-100 p-3 rounded-full">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="text-right flex-1">
                    <h4 className="font-bold text-gray-900">موظف النظام</h4>
                    <p className="text-sm text-gray-600">للموظفين والإدارة الداخلية</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </motion.button>

                <motion.button
                  onClick={() => setUserType('client')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all"
                >
                  <div className="bg-green-100 p-3 rounded-full">
                    <ShoppingCart className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="text-right flex-1">
                    <h4 className="font-bold text-gray-900">عميل / عميل</h4>
                    <p className="text-sm text-gray-600">للعملاء والعملاء التجاريين</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </motion.button>
              </div>
            </div>
          )}

          {/* Employee Authentication Form */}
          {userType === 'employee' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <motion.button
                  onClick={resetForm}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  <ArrowRight className="h-4 w-4 rotate-180" />
                  العودة
                </motion.button>
                <h3 className="text-xl font-bold text-gray-800">
                  {isSignUp ? 'إنشاء حساب موظف جديد' : 'تسجيل دخول الموظف'}
                </h3>
              </div>

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
          )}

          {/* Client Authentication Form */}
          {userType === 'client' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <motion.button
                  onClick={resetForm}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  <ArrowRight className="h-4 w-4 rotate-180" />
                  العودة
                </motion.button>
                <h3 className="text-xl font-bold text-gray-800">
                  {isSignUp ? 'تسجيل عميل جديد' : 'تسجيل دخول العميل'}
                </h3>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  <strong>ملاحظة:</strong> يلزم الحصول على معرف العميل (CLI-XXXXXXXX) من الشركة للتسجيل كعميل.
                </p>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <FormField
                  label="معرف العميل"
                  required
                  helpText="أدخل معرف العميل المقدم من الشركة (مثال: CLI-ABC12345)"
                >
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <ShoppingCart className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value.toUpperCase())}
                      className="block w-full pr-10 border rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-green-500 sm:text-sm text-left LTR-input font-mono border-gray-300"
                      placeholder="CLI-XXXXXXXX"
                      maxLength={12}
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center gap-1">
                      <motion.button
                        type="button"
                        onClick={copyClientId}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="text-gray-400 hover:text-gray-600 p-1"
                        title="نسخ"
                      >
                        {copiedClientId ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={shareClientIdOnWhatsApp}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="text-gray-400 hover:text-green-600 p-1"
                        title="مشاركة على واتساب"
                      >
                        <span className="text-xs font-bold">WA</span>
                      </motion.button>
                    </div>
                  </div>
                </FormField>

                {isSignUp && (
                  <FormField
                    label="الاسم الكامل"
                    error={validations.name?.message}
                    isValid={validations.name?.isValid}
                    required
                    helpText="أدخل اسمك الكامل"
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
                        className={`block w-full pr-10 border rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-green-500 sm:text-sm text-right ${
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
                  helpText="سيتم استخدامه لتسجيل الدخول والإشعارات"
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
                      className={`block w-full pr-10 border rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-green-500 sm:text-sm text-right LTR-input ${
                        validations.email?.touched && !validations.email?.isValid
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-300'
                      }`}
                      placeholder="client@example.com"
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
                      className={`block w-full pr-10 border rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-green-500 sm:text-sm text-right ${
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
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                    ) : isSignUp ? 'تسجيل العميل' : 'دخول العميل'}
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
                  className="text-sm text-green-600 hover:text-green-500 font-medium transition-colors"
                >
                  {isSignUp ? 'لديك حساب بالفعل؟ سجل الدخول هنا' : 'عميل جديد؟ سجل الآن'}
                </motion.button>
              </div>
            </div>
          )}
        </div>
      </CardAnimation>
    </div>
  );
};
