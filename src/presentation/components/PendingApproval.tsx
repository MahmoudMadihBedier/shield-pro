import React from 'react';
import { motion } from 'framer-motion';
import { Hourglass, LogOut, Mail } from 'lucide-react';
import type { UserProfile } from '../../application/services/auth-service';

interface PendingApprovalProps {
  profile: UserProfile;
  onSignOut: () => void;
}

// Shown after signup + email verification but before the Master Admin has
// assigned a role — the account exists and can authenticate, but has no
// role_id yet, so checkPermission() denies every module by design. Rather
// than let the user land on a confusing near-empty sidebar/dashboard, we
// explain the pending state explicitly here.
export const PendingApproval: React.FC<PendingApprovalProps> = ({ profile, onSignOut }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white shadow-lg rounded-lg p-8 max-w-md w-full text-center space-y-4"
      >
        <div className="flex justify-center">
          <motion.div
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
            className="p-3 bg-yellow-50 rounded-full text-yellow-600"
          >
            <Hourglass className="h-8 w-8" />
          </motion.div>
        </div>
        <h2 className="text-xl font-bold text-gray-900">حسابك قيد المراجعة</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          تم تأكيد بريدك الإلكتروني بنجاح، لكن مدير النظام لم يحدد دورك الوظيفي بعد. بمجرد تحديد الدور
          المناسب لك، ستتمكن من استخدام النظام مباشرة.
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-md py-2 px-3">
          <Mail className="h-4 w-4" />
          <span dir="ltr">{profile.email}</span>
        </div>
        <motion.button
          onClick={onSignOut}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 transition"
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </motion.button>
      </motion.div>
    </div>
  );
};
