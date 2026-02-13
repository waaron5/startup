/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        metal: ['"Metal Mania"', "system-ui"],
        sanspro: ['"SN Pro"', "system-ui"],
      },

      // Map colors CSS variables
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        surface: "var(--surface)",
      
        text: {
          DEFAULT: "var(--text)",
          muted: "var(--text-muted)",
        },
      
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
        },
      
        danger: {
          DEFAULT: "var(--danger)",
          hover: "var(--danger-hover)",
        },
      
        success: "var(--success)",
      },      
    },
  },
  plugins: [],
};
