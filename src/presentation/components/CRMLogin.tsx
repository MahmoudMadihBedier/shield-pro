import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, ShieldAlert, AlertCircle } from 'lucide-react';
import { CRMService } from '../../application/services/crm-service';

export function CRMLogin() {
  const [clientId, setClientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!clientId.trim()) {
      setError('يرجى إدخال معرف العميل');
      setLoading(false);
      return;
    }

    try {
      const result = await CRMService.authenticateByClientId(clientId.trim());
      
      if (result.success) {
        setSuccess(true);
        // The app will detect the session change and redirect to CRM portal
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        setError(result.error || 'فشل تسجيل الدخول');
      }
    } catch (err) {
      setError('حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4"
          >
            <ShieldAlert className="h-8 w-8 text-blue-600" />
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">بوابة العملاء</h1>
          <p className="text-gray-600 text-sm">سجل الدخول باستخدام معرف العميل الخاص بك</p>
        </div>

        {/* Success Message */}
        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-center"
          >
            <div className="flex items-center justify-center gap-2 text-green-700 font-bold mb-2">
              <Lock className="h-5 w-5" />
              تم تسجيل الدخول بنجاح
            </div>
            <p className="text-green-600 text-sm">جاري تحميل بياناتك...</p>
          </motion.div>
        )}

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6"
          >
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span className="font-bold">{error}</span>
            </div>
          </motion.div>
        )}

        {/* Login Form */}
        {!success && (
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                معرف العميل (Client ID)
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="مثال: CLI-A1B2C3D4"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left"
                dir="ltr"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-2">
                أدخل معرف العميل الذي حصلت عليه من الشركة
              </p>
            </div>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  جاري تسجيل الدخول...
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5" />
                  تسجيل الدخول
                </>
              )}
            </motion.button>
          </form>
        )}

        {/* Help Information */}
        {!success && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                ليس لديك معرف العميل؟
              </h3>
              <p className="text-sm text-blue-700">
                يرجى التواصل مع الشركة للحصول على معرف العميل الخاص بك. الشركة ستقوم بإنشاء حسابك وإعطائك معرف العميل للوصول إلى بوابة العملاء.
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}