import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { isSupabaseConfigured } from './lib/supabase.ts'
import './index.css'

registerSW({ immediate: true })

const ConfigMissingScreen = () => (
    <div dir="rtl" className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white shadow rounded-lg p-8 text-center space-y-4">
            <h1 className="text-xl font-bold text-gray-900">إعدادات الاتصال بقاعدة البيانات ناقصة</h1>
            <p className="text-gray-600 text-sm">
                لم يتم ضبط متغيرات <code dir="ltr">VITE_SUPABASE_URL</code> و<code dir="ltr">VITE_SUPABASE_ANON_KEY</code>{' '}
                في بيئة النشر. أضفهما في إعدادات المشروع على Vercel (Settings → Environment Variables) ثم أعد النشر (Redeploy)
                — يتم تضمين هذه القيم وقت البناء، فلا تكفي إضافتها بدون إعادة نشر.
            </p>
        </div>
    </div>
)

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>{isSupabaseConfigured ? <App /> : <ConfigMissingScreen />}</ErrorBoundary>
    </React.StrictMode>,
)
