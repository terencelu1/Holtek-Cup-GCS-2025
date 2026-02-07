/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Light Futuristic Palette
                'ui-bg': '#f8f9fa', // Very light grey/white background
                'ui-panel': 'rgba(255, 255, 255, 0.7)', // Glassmorphism panel
                'ui-panel-border': 'rgba(255, 255, 255, 0.9)',
                'ui-text-primary': '#1f2937', // Dark grey text
                'ui-text-secondary': '#6b7280',
                'neon-cyan': '#06b6d4', // Cyan 500
                'neon-orange': '#f97316', // Orange 500
                'status-ok': '#10b981', // Emerald 500
                'status-warn': '#eab308', // Yellow 500
                'status-err': '#ef4444', // Red 500
            },
            fontFamily: {
                'sans': ['Rajdhani', 'ui-sans-serif', 'system-ui'],
                'mono': ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular'],
            },
            backdropBlur: {
                'xs': '2px',
            }
        },
    },
    plugins: [],
}
