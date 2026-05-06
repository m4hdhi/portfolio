"use client"

import * as React from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
});

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("dark");

  React.useEffect(() => {
    const storedTheme = window.localStorage.getItem("portfolio-theme") as Theme | null;
    const initialTheme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";

    setThemeState(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const setTheme = React.useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    window.localStorage.setItem("portfolio-theme", nextTheme);
    applyTheme(nextTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return React.useContext(ThemeContext);
}
