"use client";

import { Button } from "@nextui-org/button";
import { MdLightMode, MdDarkMode } from "react-icons/md";
import { useEffect, useState } from "react";

// TODO: this does not seem to work on initial render, needs a fix

export default function LightDark() {
  const [theme, setTheme] = useState(true);

  useEffect(() => {
    if (document.cookie.includes("dark-mode=true")) {
      document.documentElement.classList.add("dark");
      setTheme(false);
    } else {
      document.documentElement.classList.remove("dark");
      setTheme(true);
    }
  }, []);
  function switchmode() {
    const checked = theme;
    if (checked === false) {
      document.documentElement.classList.add("dark");
      document.cookie = "dark-mode=true; path=/";
    } else {
      document.documentElement.classList.remove("dark");
      document.cookie = "dark-mode=false; path=/";
    }
    setTheme(!theme);
  }

  return (
    <Button
      isIconOnly
      variant="light"
      aria-label="Toggle light/dark mode"
      onClick={() => switchmode()}
    >
      {theme ? <MdLightMode size={20} /> : <MdDarkMode size={20} />}
    </Button>
  );
}
