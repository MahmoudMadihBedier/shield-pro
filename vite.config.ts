import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// https://vitejs.dev/config/
export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon.svg', 'favicon-32x32.png', 'apple-touch-icon.png'],
            manifest: {
                id: '/',
                name: 'شيلد برو - نظام إدارة المنشأة',
                short_name: 'شيلد برو',
                description: 'نظام إدارة موارد المنشأة (ERP) لمصنع لواصق الإطارات الفورية',
                lang: 'ar',
                dir: 'rtl',
                start_url: '/',
                display: 'standalone',
                background_color: '#0f172a',
                theme_color: '#1d4ed8',
                icons: [
                    { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
                    { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
                navigateFallbackDenylist: [/^\/api\//],
            },
            devOptions: {
                enabled: false,
            },
        }),
    ],
    server: {
        port: 3000,
        open: true,
    },
})
