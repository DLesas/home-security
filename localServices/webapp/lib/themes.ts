"use server";

import { promises as fs } from "fs";

// {
//   themes: {
//     'theme-blue-light': { extend: 'light', colors: [Object] },
//     'theme-blue-dark': { extend: 'dark', colors: [Object] },
//     'theme-purple-light': { extend: 'light', colors: [Object] },
//     'theme-purple-dark': { extend: 'dark', colors: [Object] },
//     'theme-orange-light': { extend: 'light', colors: [Object] },
//     'theme-orange-dark': { extend: 'dark', colors: [Object] },
//     'theme-green-light': { extend: 'light', colors: [Object] },
//     'theme-green-dark': { extend: 'dark', colors: [Object] }
//   }
// }

export async function getThemes() {
  const file = await fs.readFile("themes.json", "utf-8");
  const json = JSON.parse(file);
  const themesArr = [];
  for (const theme in json.themes) {
    themesArr.push({
      "theme": theme,
      "color": json.themes[theme].colors.primary.DEFAULT,
    });
  }
  return themesArr;
}
