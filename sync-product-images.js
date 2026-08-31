#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VERSION = 8;
const IMAGE_EXTENSIONS = new Set(['.webp', '.png', '.jpg', '.jpeg', '.jfif', '.avif', '.gif', '.bmp', '.svg']);
const SKIP_DIRS = new Set(['auto-mapped', 'node_modules', '.git', '.svn', '.hg', '.cache', 'thumbs']);
const EXTENSION_RANK = new Map([
  ['.webp', 8], ['.png', 7], ['.jpg', 6], ['.jpeg', 6], ['.jfif', 5],
  ['.avif', 5], ['.gif', 3], ['.bmp', 2], ['.svg', 1]
]);

function parseArgs(argv) {
  const result = {};
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) continue;
    const value = argv[index + 1];
    result[key.slice(2)] = value && !value.startsWith('--') ? argv[++index] : true;
  }
  return result;
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[×*]/g, ' x ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function compactText(value) {
  return normalizeText(value).replace(/\s+/g, '');
}

function codeAliases(value) {
  const raw = String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const withX = raw.replace(/[×*]/g, 'x').replace(/[^a-z0-9]/g, '');
  const withoutX = withX.replace(/(?<=\d)x(?=\d)/g, '');
  const plain = raw.replace(/[^a-z0-9]/g, '');
  return unique([withX, withoutX, plain].filter(Boolean));
}

function stemCodeForms(value) {
  const raw = String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const withX = raw.replace(/[×*]/g, 'x').replace(/[^a-z0-9]/g, '');
  const withoutX = withX.replace(/(?<=\d)x(?=\d)/g, '');
  return unique([withX, withoutX].filter(Boolean));
}

function stripLeadingCode(description, code) {
  const raw = String(description ?? '').trim();
  const part = String(code ?? '').trim();
  if (!raw || !part) return raw;
  const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return raw.replace(new RegExp(`^\\s*${escaped}\\s*[-–—_:|/]*\\s*`, 'i'), '').trim() || raw;
}

function unique(values) {
  return [...new Set(values)];
}

function addIndex(map, key, index) {
  if (!key) return;
  let values = map.get(key);
  if (!values) map.set(key, values = []);
  values.push(index);
}

function safeFilePart(value) {
  return String(value || 'product')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 90) || 'product';
}

function isWithin(child, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function webPath(publicRoot, filePath) {
  return path.relative(publicRoot, filePath)
    .split(path.sep)
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

function walkImages(root, output) {
  let stats;
  try { stats = fs.statSync(root); } catch (_) { return; }
  if (stats.isFile()) {
    if (IMAGE_EXTENSIONS.has(path.extname(root).toLowerCase())) output.push(path.resolve(root));
    return;
  }
  if (!stats.isDirectory()) return;
  const baseName = path.basename(root).toLowerCase();
  if (SKIP_DIRS.has(baseName) || baseName.startsWith('.')) return;
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch (_) { return; }
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) walkImages(full, output);
    else if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) output.push(path.resolve(full));
  }
}

function stemVariants(filePath) {
  const original = path.basename(filePath, path.extname(filePath));
  const variants = [original];
  const cleaned = original
    .replace(/\s*(?:\(\d+\)|\[\d+\]|copy(?:\s*\d+)?|final(?:\s*\d+)?|edited(?:\s*\d+)?|new(?:\s*\d+)?|small|large|thumb(?:nail)?)\s*$/i, '')
    .trim();
  if (cleaned && cleaned !== original) variants.push(cleaned);
  return unique(variants);
}

function buildTrie(codeMap) {
  const root = { next: new Map(), indexes: null };
  for (const [code, indexes] of codeMap.entries()) {
    if (code.length < 4) continue;
    let node = root;
    for (const char of code) {
      if (!node.next.has(char)) node.next.set(char, { next: new Map(), indexes: null });
      node = node.next.get(char);
    }
    node.indexes = indexes;
  }
  return root;
}

function findLongestCode(stem, trie) {
  const found = [];
  for (let start = 0; start < stem.length; start += 1) {
    let node = trie;
    for (let cursor = start; cursor < stem.length; cursor += 1) {
      node = node.next.get(stem[cursor]);
      if (!node) break;
      if (node.indexes) found.push({ start, length: cursor - start + 1, indexes: node.indexes });
    }
  }
  if (!found.length) return null;
  const longest = Math.max(...found.map(item => item.length));
  const candidates = found.filter(item => item.length === longest);
  const earliest = Math.min(...candidates.map(item => item.start));
  return {
    start: earliest,
    length: longest,
    indexes: unique(candidates.filter(item => item.start === earliest).flatMap(item => item.indexes))
  };
}

function copyExternalImage(source, autoOutputDir) {
  fs.mkdirSync(autoOutputDir, { recursive: true });
  const extension = path.extname(source).toLowerCase() || '.jpg';
  const digest = crypto.createHash('sha1').update(path.resolve(source)).digest('hex').slice(0, 12);
  const destination = path.join(autoOutputDir, `${safeFilePart(path.basename(source, extension))}-${digest}${extension}`);
  let copy = true;
  try {
    const sourceStats = fs.statSync(source);
    const destinationStats = fs.statSync(destination);
    copy = sourceStats.size !== destinationStats.size || sourceStats.mtimeMs > destinationStats.mtimeMs + 1;
  } catch (_) {}
  if (copy) fs.copyFileSync(source, destination);
  return destination;
}

function readExtraFolders(projectRoot, publicRoot) {
  const roots = [];
  const files = [
    path.join(projectRoot, 'PRODUCT_IMAGE_FOLDER.txt'),
    path.join(publicRoot, 'PRODUCT_IMAGE_FOLDER.txt')
  ];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const value = rawLine.trim().replace(/^['"]|['"]$/g, '');
      if (!value || value.startsWith('#')) continue;
      const resolved = path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
      if (fs.existsSync(resolved)) roots.push(path.resolve(resolved));
    }
  }
  return unique(roots);
}

function writeAtomic(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, contents, 'utf8');
  try { fs.rmSync(file, { force: true }); } catch (_) {}
  fs.renameSync(temporary, file);
}

function writeJsonAtomic(file, value) {
  writeAtomic(file, JSON.stringify(value, null, 2));
}

function chooseExact(stem, indexes) {
  const textKey = normalizeText(stem);
  const forms = stemCodeForms(stem);
  const tests = [
    ['exact-id', 100, indexes.id.get(textKey)],
    ...forms.map(form => ['exact-code', 99, indexes.codeAlias.get(form)]),
    ['exact-code-description', 97, indexes.combined.get(textKey)],
    ['exact-description', 95, indexes.description.get(textKey)],
    ['exact-short-description', 93, (indexes.shortDescription.get(textKey)?.length === 1 ? indexes.shortDescription.get(textKey) : null)]
  ];
  for (const [method, score, values] of tests) {
    if (values?.length) return { method, score, indexes: unique(values) };
  }
  return null;
}

function matchImage(filePath, indexes, trie) {
  for (const stem of stemVariants(filePath)) {
    const exact = chooseExact(stem, indexes);
    if (exact) return exact;

    for (const form of stemCodeForms(stem)) {
      const codeMatch = findLongestCode(form, trie);
      if (!codeMatch?.indexes?.length) continue;
      return {
        method: codeMatch.start === 0 ? 'product-code-at-start' : 'product-code-inside-filename',
        score: codeMatch.start === 0 ? 89 : 82,
        indexes: codeMatch.indexes
      };
    }
  }
  return null;
}

function main() {
  const args = parseArgs(process.argv);
  const publicRoot = path.resolve(args['public-root'] || __dirname);
  const projectRoot = path.resolve(args['project-root'] || path.dirname(publicRoot));
  const primaryImagesDir = path.join(publicRoot, 'assets', 'products');
  const autoOutputDir = path.join(primaryImagesDir, 'auto-mapped');
  const productsFile = path.join(publicRoot, 'data', 'products.json');
  const outputFile = path.join(publicRoot, 'data', 'product-image-map.json');
  const reportFile = path.join(publicRoot, 'data', 'product-image-report.json');
  const resultFile = path.join(projectRoot, 'PRODUCT_IMAGE_MAPPING_RESULT.txt');

  if (!fs.existsSync(productsFile)) throw new Error(`Product data not found: ${productsFile}`);
  fs.mkdirSync(primaryImagesDir, { recursive: true });
  const products = JSON.parse(fs.readFileSync(productsFile, 'utf8'));
  if (!Array.isArray(products)) throw new Error('products.json must contain a JSON array.');

  const indexes = {
    id: new Map(),
    codeAlias: new Map(),
    description: new Map(),
    shortDescription: new Map(),
    combined: new Map()
  };

  products.forEach((product, index) => {
    const code = String(product?.code ?? '');
    const description = String(product?.description ?? '');
    const shortDescription = stripLeadingCode(description, code);
    addIndex(indexes.id, normalizeText(product?.id), index);
    for (const alias of codeAliases(code)) addIndex(indexes.codeAlias, alias, index);
    addIndex(indexes.description, normalizeText(description), index);
    addIndex(indexes.shortDescription, normalizeText(shortDescription), index);
    addIndex(indexes.combined, normalizeText(`${code} ${shortDescription}`), index);
  });

  const trie = buildTrie(indexes.codeAlias);
  const roots = unique([primaryImagesDir, ...readExtraFolders(projectRoot, publicRoot)].map(item => path.resolve(item)));
  const discovered = [];
  for (const root of roots) walkImages(root, discovered);
  const imageFiles = unique(discovered).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const bestByProduct = new Map();
  const imageMatches = [];
  const unmatchedImages = [];
  const ambiguousImages = [];

  for (const imagePath of imageFiles) {
    const match = matchImage(imagePath, indexes, trie);
    const source = isWithin(imagePath, projectRoot)
      ? path.relative(projectRoot, imagePath).split(path.sep).join('/')
      : imagePath;
    if (!match?.indexes?.length) {
      unmatchedImages.push(source);
      continue;
    }

    const servedFile = isWithin(imagePath, publicRoot) ? imagePath : copyExternalImage(imagePath, autoOutputDir);
    const imageUrl = webPath(publicRoot, servedFile);
    const extensionBonus = EXTENSION_RANK.get(path.extname(imagePath).toLowerCase()) || 0;
    const finalScore = match.score * 100 + extensionBonus;

    if (match.indexes.length > 1) {
      ambiguousImages.push({ source, image: imageUrl, method: match.method, productCount: match.indexes.length });
    }

    let selectedFor = 0;
    for (const productIndex of match.indexes) {
      const existing = bestByProduct.get(productIndex);
      if (!existing || finalScore > existing.score || (finalScore === existing.score && imageUrl.localeCompare(existing.image) < 0)) {
        bestByProduct.set(productIndex, { image: imageUrl, source, method: match.method, score: finalScore });
        selectedFor += 1;
      }
    }

    imageMatches.push({
      source,
      image: imageUrl,
      method: match.method,
      productCount: match.indexes.length,
      selectedFor,
      productCodes: match.indexes.slice(0, 30).map(index => String(products[index]?.code || ''))
    });
  }

  const byId = {};
  const byCode = {};
  const byCodeCompact = {};
  const byDescription = {};
  for (const [productIndex, selected] of bestByProduct.entries()) {
    const product = products[productIndex] || {};
    const id = String(product.id ?? '');
    const codeKey = normalizeText(product.code);
    const descriptionKey = normalizeText(product.description);
    if (id) byId[id] = selected.image;
    if (codeKey && !byCode[codeKey]) byCode[codeKey] = selected.image;
    for (const alias of codeAliases(product.code)) if (alias && !byCodeCompact[alias]) byCodeCompact[alias] = selected.image;
    if (descriptionKey && !byDescription[descriptionKey]) byDescription[descriptionKey] = selected.image;
  }

  const generatedAt = new Date().toISOString();
  const manifest = {
    version: VERSION,
    generatedAt,
    imagesFolder: primaryImagesDir,
    searchedRoots: roots,
    productsScanned: products.length,
    scannedImageFiles: imageFiles.length,
    matchedImageFiles: imageMatches.length,
    matchedProducts: bestByProduct.size,
    byId,
    byCode,
    byCodeCompact,
    byDescription
  };
  const report = {
    version: VERSION,
    generatedAt,
    productsScanned: products.length,
    imagesFolder: primaryImagesDir,
    searchedRoots: roots,
    imagesScanned: imageFiles.length,
    matchedImageFiles: imageMatches.length,
    matchedProducts: bestByProduct.size,
    unmatchedImageFiles: unmatchedImages.length,
    ambiguousImageFiles: ambiguousImages.length,
    matches: imageMatches,
    unmatchedImages,
    ambiguousImages
  };

  writeJsonAtomic(outputFile, manifest);
  writeJsonAtomic(reportFile, report);

  const exampleProducts = products.slice(0, 15);
  const summary = [
    `RAJ PRODUCT IMAGE AUTO-MAPPING V${VERSION}`,
    `Generated: ${generatedAt}`,
    '',
    `Images folder: ${primaryImagesDir}`,
    `Products scanned: ${products.length}`,
    `Image files scanned: ${imageFiles.length}`,
    `Matched image files: ${imageMatches.length}`,
    `Products with images: ${bestByProduct.size}`,
    `Unmatched image files: ${unmatchedImages.length}`,
    `Ambiguous image files: ${ambiguousImages.length}`,
    '',
    imageFiles.length === 0
      ? 'STATUS: Products folder is empty. Copy images into public\\assets\\products and run START_ADMIN.bat again.'
      : bestByProduct.size > 0
        ? 'STATUS: SUCCESS. Browser image map was generated.'
        : 'STATUS: Images were found, but filenames did not match product codes or names.',
    '',
    'Recommended image filenames:',
    ...exampleProducts.flatMap(product => [
      `- ${String(product.code || '').trim()}.jpg`,
      `- ${String(product.description || '').trim()}.png`
    ])
  ].join('\r\n');
  writeAtomic(resultFile, summary);

  console.log('');
  console.log('======================================================');
  console.log(`  PRODUCT IMAGE AUTO-MAPPING V${VERSION} COMPLETE`);
  console.log('======================================================');
  console.log(`Images folder    : ${primaryImagesDir}`);
  console.log(`Products scanned : ${products.length}`);
  console.log(`Images scanned   : ${imageFiles.length}`);
  console.log(`Images matched   : ${imageMatches.length}`);
  console.log(`Products matched : ${bestByProduct.size}`);
  console.log(`Report           : ${reportFile}`);
  console.log('');
  if (!imageFiles.length) console.log('INFO: Copy product images into public\\assets\\products, then run START_ADMIN.bat again.');
  else if (!bestByProduct.size) console.log('WARNING: Rename image files using product code or full product name.');
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error?.stack || error}`);
  process.exitCode = 1;
}
