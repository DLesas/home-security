import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { glob } from "glob";
import { existsSync, statSync } from "fs";

async function fixImports() {
  const files = await glob("dist/**/*.js");

  for (const file of files) {
    let content = await readFile(file, "utf-8");

    // Add .js extension to all local imports
    content = content.replace(
      /from ['"](\.\.?\/[^'"]*)['"]/g,
      (match, importPath) => {
        if (!importPath.endsWith(".js")) {
          // Resolve the path relative to the current file
          const currentDir = file.replace(/[^/]*$/, "");
          const resolvedPath = join(currentDir, importPath);

          // Check if it's a directory with an index.js file
          if (
            existsSync(resolvedPath) &&
            statSync(resolvedPath).isDirectory()
          ) {
            const indexPath = join(resolvedPath, "index.js");
            if (existsSync(indexPath)) {
              return `from '${importPath}/index.js'`;
            }
          }

          // Otherwise, just add .js extension
          return `from '${importPath}.js'`;
        }
        return match;
      }
    );

    await writeFile(file, content, "utf-8");
  }
}

fixImports().catch(console.error);
