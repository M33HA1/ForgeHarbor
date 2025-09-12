module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        aqua: "#e0f7fa",
        coral: "#ff8a65",
        biolight: "#43d9ad",
      },
      animation: {
        gradient: 'gradient 6s ease infinite',
        bubble: 'bubble-rise 12s linear infinite',
        'swim-left': 'swim-left 16s linear infinite',
        'swim-right': 'swim-right 16s linear infinite',
        swim: 'swim 20s linear infinite',
        slowfade: 'slowfade 10s ease-in-out infinite',
      },
      keyframes: {
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'bubble-rise': {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '0.3' },
          '50%': { transform: 'translateY(-60vh) scale(1.2)', opacity: '0.6' },
          '100%': { transform: 'translateY(-120vh) scale(0.9)', opacity: '0' },
        },
        'swim-left': {
          '0%': { transform: 'translateX(0)', opacity: '0.2' },
          '50%': { opacity: '0.5' },
          '100%': { transform: 'translateX(-120vw)', opacity: '0' },
        },
        'swim-right': {
          '0%': { transform: 'translateX(0)', opacity: '0.2' },
          '50%': { opacity: '0.5' },
          '100%': { transform: 'translateX(120vw)', opacity: '0' },
        },
        swim: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(120vw)' },
        },
        slowfade: {
          '0%, 100%': { opacity: '0.1', transform: 'translateY(0px)' },
          '50%': { opacity: '0.22', transform: 'translateY(12px)' },
        },
      },
      dropShadow: {
        glow: "0 0 6px rgba(67, 217, 173, 0.6)",
      },
    },
  },
  plugins: [],
};