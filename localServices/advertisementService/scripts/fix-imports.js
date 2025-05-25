import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { glob } from 'glob';

async function fixImports() {
  const files = await glob('dist/**/*.js');
  
  for (const file of files) {
    let content = await readFile(file, 'utf-8');
    
    // Add .js extension to all local imports
    content = content.replace(
      /from ['"](\.\.?\/[^'"]*)['"]/g,
      (match, importPath) => {
        if (!importPath.endsWith('.js')) {
          return `from '${importPath}.js'`;
        }
        return match;
      }
    );
    
    await writeFile(file, content, 'utf-8');
  }
}

fixImports().catch(console.error); 