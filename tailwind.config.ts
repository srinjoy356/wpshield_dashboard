import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--border)",
        ring: "var(--foreground)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: {
          DEFAULT: "var(--surface)",
          subtle: "var(--surface-subtle)"
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        alert: "var(--alert)",
        critical: "var(--critical)",
        info: "var(--info)",
        brand: {
          DEFAULT: "var(--brand)",
          soft: "var(--brand-soft)"
        },
        // Monochrome design-system tokens, ported from the DPDP tool so both
        // products share one palette. Additive — nothing above was renamed,
        // so existing usages of bg-background / text-foreground / etc keep
        // working unchanged and just pick up the new values automatically.
        bg2: "var(--bg-2)",
        bg3: "var(--bg-3)",
        text2: "var(--text-2)",
        text3: "var(--text-3)",
        text4: "var(--text-4)",
        border2: "var(--border-2)",
        sidebar: {
          DEFAULT: "var(--sidebar-bg)",
          text: "var(--sidebar-text)",
          activeBg: "var(--sidebar-active-bg)",
          activeText: "var(--sidebar-active-text)",
          hoverBg: "var(--sidebar-hover-bg)",
        },
        glass: {
          DEFAULT: "var(--glass-bg)",
          border: "var(--glass-border)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 6px)",
        xl: "var(--radius-lg)",
        "2xl": "var(--radius-xl)"
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow)",
        lg: "var(--shadow-lg)"
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config