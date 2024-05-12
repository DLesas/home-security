import { create } from "zustand";

type Mode = "dark" | "light" | "system";

interface ThemeStore {
  mode: Mode;
  color: string;
  setMode: (mode: Mode) => void;
  setColor: (color: string) => void;
}

function clearThemeclasses() {
  const classes = Array.from(document.documentElement.classList)
    .filter((c) => c.startsWith("theme-"));
  for (const c of classes) {
    document.documentElement.classList.remove(c);
  }
}

function changeThemeModeSystem(event: any, color: string, setter: any) {
  clearThemeclasses();
  const newColorScheme = event.matches ? "dark" : "light";
  document.documentElement.classList.add(`theme-${color}-${newColorScheme}`);
  setter((state: ThemeStore) => ({ ...state, mode: newColorScheme }));
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  mode: "light",
  color: "default",
  setMode: (mode: Mode) => {
    //TODO: This doesnt clear the event listener because the function gets redefined everytime this is run
    const color = get().color;
    const changeThemeModeSystemHandler = (e: MediaQueryListEvent) =>
      changeThemeModeSystem(e, color, set);
    clearThemeclasses();
    window.matchMedia("(prefers-color-scheme: dark)").removeEventListener(
      "change",
      changeThemeModeSystemHandler,
    );
    if (mode === "system") {
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        set((state) => ({ ...state, mode: "dark" }));
        document.documentElement.classList.add(`theme-${color}-dark`);
      } else {
        set((state) => ({ ...state, mode: "light" }));
        document.documentElement.classList.add(`theme-${color}-light`);
      }
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener(
        "change",
        changeThemeModeSystemHandler,
      );
    } else {
      document.documentElement.classList.add(`theme-${color}-${mode}`);
      set((state) => ({ ...state, mode }));
    }
  },
  setColor: (color: string) => {
    clearThemeclasses();
    const mode = get().mode;
    document.documentElement.classList.add(`theme-${color}-${mode}`);
    set((state) => ({ ...state, color }));
  },
}));
