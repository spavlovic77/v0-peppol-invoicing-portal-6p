import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const files = [
  'lib/pdf-template.tsx',
  'components/supplier-form.tsx',
  'components/navbar.tsx',
  'components/invoice/step-buyer.tsx',
  'components/invoice/step-summary.tsx',
  'components/invoice/step-items.tsx',
  'components/invoice/step-basic-info.tsx',
  'components/invoice/validation-display.tsx',
  'app/(onboarding)/onboarding/page.tsx',
  'app/(app)/suppliers/page.tsx',
  'app/(app)/buyers/page.tsx',
  'app/(app)/invoices/[id]/page.tsx',
  'app/(app)/dashboard/page.tsx',
];

const root = '/vercel/share/v0-project';

let totalReplacements = 0;

for (const file of files) {
  const fullPath = resolve(root, file);
  let content = readFileSync(fullPath, 'utf8');
  
  // Replace all \uXXXX patterns with actual UTF-8 characters
  const replaced = content.replace(/\\u([0-9A-Fa-f]{4})/g, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  
  if (replaced !== content) {
    const count = (content.match(/\\u[0-9A-Fa-f]{4}/g) || []).length;
    totalReplacements += count;
    writeFileSync(fullPath, replaced, 'utf8');
    console.log(`[v0] Fixed ${count} escapes in ${file}`);
  } else {
    console.log(`[v0] No escapes found in ${file}`);
  }
}

console.log(`[v0] Total: ${totalReplacements} replacements across ${files.length} files`);
