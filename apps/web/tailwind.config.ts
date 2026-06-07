import type { Config } from "tailwindcss"

export default {
  theme: {
    extend: {
      colors: {
        accent: "var(--accent)",
        danger: "var(--danger)",
        success: "var(--success)",
        warning: "var(--warning)",
        surface: "var(--surface)",
        "surface-elevated": "var(--surface-elevated)",
      },
    },
  },
} satisfies Config
