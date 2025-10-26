/**
 * Pre-processing script: Build lightweight search index from full thesaurus
 * 
 * This script:
 * 1. Loads your massive 750k-line thesaurus JSON
 * 2. Flattens the hierarchy into a searchable array
 * 3. Removes SubTerms (not needed for search)
 * 4. Saves a much smaller index file for the frontend
 * 
 * Usage:
 *   node scripts/buildThesaurusIndex.js
 * 
 * Input:  public/thesaurus-full.json (your 750k line file)
 * Output: public/thesaurus-index.json (lightweight search index, ~5-10MB)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Building thesaurus search index...\n');

// Paths
const inputPath = path.join(__dirname, '../public/thesaurus-full.json');
const outputPath = path.join(__dirname, '../public/thesaurus-index.json');

// Check input exists
if (!fs.existsSync(inputPath)) {
  console.error('❌ Error: thesaurus-full.json not found!');
  console.error(`   Expected at: ${inputPath}`);
  console.error('\n📝 Please place your thesaurus JSON at:');
  console.error('   public/thesaurus-full.json');
  process.exit(1);
}

// Load thesaurus
console.log('📂 Loading thesaurus...');
const thesaurus = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
console.log(`   Loaded ${Array.isArray(thesaurus) ? thesaurus.length : 1} root categories\n`);

// Build search index
const searchIndex = [];

/**
 * Recursively flatten the tree structure
 */
function flatten(node, parentLabels = []) {
  const pathLabels = [...parentLabels, node.Label];
  
  // Add to search index (exclude SubTerms to save space)
  searchIndex.push({
    id: node.KeywordID,
    label: node.Label,
    labelLower: node.Label.toLowerCase(),
    parentId: node.ParentID,
    parentLabel: node.ParentLabel,
    rootCategory: node.CategoryRootKeywordLabel,
    path: pathLabels,
    pathString: pathLabels.join(' › '),
    depth: parentLabels.length,
    isPreferred: node.IsPreferred === 1,
  });
  
  // Recurse into children
  if (node.SubTerms && Array.isArray(node.SubTerms)) {
    node.SubTerms.forEach(child => flatten(child, pathLabels));
  }
}

// Process all root nodes
console.log('🔄 Flattening hierarchy...');
if (Array.isArray(thesaurus)) {
  thesaurus.forEach(root => flatten(root));
} else {
  // Single root object
  flatten(thesaurus);
}

console.log(`   Indexed ${searchIndex.length.toLocaleString()} keywords\n`);

// Calculate sizes
const originalSize = fs.statSync(inputPath).size;
const indexData = JSON.stringify(searchIndex);
const indexSize = Buffer.byteLength(indexData, 'utf8');

console.log('💾 File sizes:');
console.log(`   Original: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`   Index:    ${(indexSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`   Reduction: ${((1 - indexSize / originalSize) * 100).toFixed(1)}%\n`);

// Write index file
console.log('💾 Writing search index...');
fs.writeFileSync(outputPath, indexData);

console.log(`   ✅ Saved to: ${outputPath}\n`);
console.log('🎉 Done! Your thesaurus is ready to use.\n');
console.log('Next steps:');
console.log('  1. The index file is in public/thesaurus-index.json');
console.log('  2. It will be loaded by the Web Worker on first search');
console.log('  3. You can now delete public/thesaurus-full.json (optional)');

