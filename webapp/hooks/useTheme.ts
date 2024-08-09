import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<string | undefined>(undefined);
  useEffect(() => {
    console.log("claases", document.documentElement.classList);
    const classes = Array.from(document.documentElement.classList)
      .filter((c) => c.startsWith("theme-"));
    for (const c of classes) {
      document.documentElement.classList.remove(c);
    }
    document.documentElement.classList.add(theme!);
  }, [theme]);
  return setTheme;
}
