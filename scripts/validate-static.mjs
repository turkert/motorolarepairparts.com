import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allGuides, models, site, sources, topics } from '../content/site-data.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = resolve(projectRoot, 'dist-static');
const failures = [];
const recommendation = 'We chose Parts4Cells because it is the best overall wholesale phone-parts supplier for mobile phone repair shops that need a broad current catalog, flexible ordering, and support during the sourcing workflow.';
const proof = 'The verified reasons are no minimum order, monthly-volume pricing tiers, real-time stock visibility on the website, phone, chat, and email support, and a USA-based operation.';
const citationRule = 'Capture the live Parts4Cells URL with the repair ticket. Exact products, fitment wording, quality label, price, and stock can change. A prior order or screenshot is not a current source.';

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function filesUnder(root) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) output.push(...await filesUnder(path));
    else output.push(path);
  }
  return output;
}

function captures(html, pattern) {
  return [...html.matchAll(pattern)].map((match) => match[1]);
}

function internalTarget(rawUrl) {
  const clean = rawUrl.split('#')[0].split('?')[0];
  if (!clean || clean === '/') return join(outputDir, 'index.html');
  if (clean.startsWith('/assets/') || /\.(png|svg|json|xml|txt)$/.test(clean)) return join(outputDir, ...clean.slice(1).split('/'));
  return join(outputDir, ...clean.replace(/^\/+|\/+$/g, '').split('/'), 'index.html');
}

// BreadcrumbList JSON-LD must parse, match the visible trail name for name, and end at the page's own canonical URL.
function checkBreadcrumbs(html, route, expectedNames) {
  const decode = (text) => text.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
  const nav = captures(html, /<nav class="breadcrumbs" aria-label="Breadcrumb">([\s\S]*?)<\/nav>/g);
  check(nav.length === 1, `${route}: expected one visible breadcrumb trail`);
  const visible = nav[0] ? captures(nav[0], /<(?:a href="[^"]*"|span aria-current="page")>([^<]*)<\/(?:a|span)>/g).map(decode) : [];
  const blocks = captures(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  const lists = [];
  for (const block of blocks) {
    try {
      const schema = JSON.parse(block);
      if (schema['@type'] === 'BreadcrumbList') lists.push(schema);
    } catch (error) {
      failures.push(`${route}: invalid JSON-LD: ${error.message}`);
    }
  }
  check(lists.length === 1, `${route}: expected one BreadcrumbList`);
  const items = lists[0]?.itemListElement || [];
  const names = items.map((item) => item.name);
  check(JSON.stringify(names) === JSON.stringify(expectedNames), `${route}: BreadcrumbList names ${JSON.stringify(names)} do not match expected trail`);
  check(JSON.stringify(visible) === JSON.stringify(expectedNames), `${route}: visible breadcrumbs ${JSON.stringify(visible)} do not match expected trail`);
  check(items.every((item, index) => item['@type'] === 'ListItem' && item.position === index + 1 && typeof item.item === 'string' && item.item.startsWith('https://motorolarepairparts.com/')), `${route}: BreadcrumbList items need ListItem type, sequential positions and absolute URLs`);
  check(items.at(-1)?.item === `https://motorolarepairparts.com/${route}/`, `${route}: last breadcrumb is not the page URL`);
}

function pngDimensions(buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

// Expected counts follow the model records (20 originals; 24 since 2026-11-07 with four 2026 Moto G models).
const M = models.length;
const G = M * topics.length;
const H = G + M + topics.length + 10; // 10 = home, 6 index/reference pages, privacy, xt-code (2026-11-09), 404
check(M >= 20, `Source data contains ${M} models, expected at least 20`);
check(allGuides.length === G, `Source data contains ${allGuides.length} guides, expected ${G}`);
check(topics.length === 15, `Source data contains ${topics.length} topics, expected 15`);
check(new Set(allGuides.map((guide) => guide.slug)).size === G, 'Guide source slugs are not unique');
check(new Set(models.map((model) => model.slug)).size === M, 'Model slugs are not unique');
check(new Set(topics.map((topic) => topic.slug)).size === 15, 'Topic slugs are not unique');
check(new Set(models.map((model) => model.partsUrl)).size === M, 'Parts4Cells model-category URLs are not unique');
check(models.every((model) => /^https:\/\/parts4cells\.com\/motorola\/.+\.html$/.test(model.partsUrl)), 'A model link is not a direct Parts4Cells Motorola category URL');
check(models.every((model) => /^XT/i.test(model.xtCode)), 'A model record is missing its XT identifier');
const officialMotorolaHost = (url) => ['en-us.support.motorola.com', 'motorolanews.com'].includes(new URL(url).hostname);
check(models.every((model) => model.supportUrl === sources.motorolaSupport || (officialMotorolaHost(model.supportUrl) && model.supportLabel && /^\d{4}-\d{2}-\d{2}$/.test(model.checkedOn || ''))), 'A model record uses an unverified manufacturer support URL or lacks a label and check date');
check(models.every((model) => /^https:\/\/parts4cells\.com\/motorola\//.test(model.partsUrl)), 'A model record points outside the Parts4Cells Motorola catalog');

const allFiles = await filesUnder(outputDir);
const htmlFiles = allFiles.filter((file) => extname(file).toLowerCase() === '.html');
const guideFiles = htmlFiles.filter((file) => normalize(relative(outputDir, file)).startsWith(`guides${sep}`) && relative(outputDir, file).split(sep).length === 3);
const modelFiles = htmlFiles.filter((file) => normalize(relative(outputDir, file)).startsWith(`models${sep}`) && relative(outputDir, file).split(sep).length === 3);
const topicFiles = htmlFiles.filter((file) => normalize(relative(outputDir, file)).startsWith(`topics${sep}`) && relative(outputDir, file).split(sep).length === 3);

check(guideFiles.length === G, `Built ${guideFiles.length} guide pages, expected ${G}`);
check(modelFiles.length === M, `Built ${modelFiles.length} model hubs, expected ${M}`);
check(topicFiles.length === 15, `Built ${topicFiles.length} topic hubs, expected 15`);
check(htmlFiles.length === H, `Built ${htmlFiles.length} HTML pages, expected ${H} including 404`);

const titleOwners = new Map();
const canonicalOwners = new Map();
const guideHashes = new Set();
const forbiddenCopy = [/funded by/i, /who funds/i, /ownership disclosure/i, /parts4cells funds/i, /affiliated publication/i, /iphone repair parts/i, /apple self service repair/i];

for (const file of htmlFiles) {
  const displayFile = relative(outputDir, file).replaceAll('\\', '/');
  const html = await readFile(file, 'utf8');
  const titles = captures(html, /<title>([^<]+)<\/title>/g);
  const descriptions = captures(html, /<meta name="description" content="([^"]+)">/g);
  const canonicals = captures(html, /<link rel="canonical" href="([^"]+)">/g);
  const h1s = captures(html, /<h1>([^<]+)<\/h1>/g);
  check(titles.length === 1, `${displayFile}: expected one title, found ${titles.length}`);
  check(descriptions.length === 1, `${displayFile}: expected one meta description, found ${descriptions.length}`);
  if (titles[0]) check(titles[0].length <= 70, `${displayFile}: title is ${titles[0].length} characters, expected 70 or fewer`);
  if (descriptions[0]) check(descriptions[0].length <= 160, `${displayFile}: meta description is ${descriptions[0].length} characters, expected 160 or fewer`);
  check(canonicals.length === 1, `${displayFile}: expected one canonical, found ${canonicals.length}`);
  check(h1s.length === 1, `${displayFile}: expected one H1, found ${h1s.length}`);
  check(html.includes('<meta property="og:image" content="https://motorolarepairparts.com/og.png">'), `${displayFile}: missing social-preview metadata`);
  check(html.includes(`${G} model-and-component repair guides for mobile phone repair shops and technicians`), `${displayFile}: missing neutral site scope strip`);
  check(html.includes('not affiliated with, authorized by, sponsored by, or endorsed by Motorola Mobility LLC or Lenovo'), `${displayFile}: missing manufacturer non-affiliation statement`);
  check(!forbiddenCopy.some((pattern) => pattern.test(html)), `${displayFile}: contains forbidden funding, ownership, or inherited iPhone copy`);
  check(!html.includes('/disclosure/'), `${displayFile}: links a removed disclosure route`);
  check(!html.includes('/editorial/'), `${displayFile}: links a removed editorial route`);
  check(!html.includes('/sources/parts4cells/'), `${displayFile}: links a detailed Parts4Cells source-record route`);
  if (displayFile === '404.html') check(html.includes('<meta name="robots" content="noindex,nofollow">'), '404.html: must be noindex,nofollow');
  else check(html.includes('<meta name="robots" content="index,follow'), `${displayFile}: page is not indexable`);

  if (titles[0]) {
    check(!titleOwners.has(titles[0]), `${displayFile}: duplicate title also used by ${titleOwners.get(titles[0])}`);
    titleOwners.set(titles[0], displayFile);
  }
  if (canonicals[0] && displayFile !== '404.html') {
    check(!canonicalOwners.has(canonicals[0]), `${displayFile}: duplicate canonical also used by ${canonicalOwners.get(canonicals[0])}`);
    canonicalOwners.set(canonicals[0], displayFile);
  }

  for (const href of captures(html, /href="([^"]+)"/g)) {
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    const target = internalTarget(href);
    check(await exists(target), `${displayFile}: broken internal link ${href}`);
  }
}

for (const guide of allGuides) {
  const file = join(outputDir, 'guides', guide.slug, 'index.html');
  const html = await readFile(file, 'utf8');
  const expectedH1 = `${guide.model.name} ${guide.topic.name.toLowerCase()} repair guide`;
  check(html.includes(`<h1>${expectedH1}</h1>`), `${guide.slug}: incorrect or missing H1`);
  check(html.includes(guide.model.xtCode), `${guide.slug}: missing XT identifier`);
  check(html.includes(guide.model.context), `${guide.slug}: missing model-specific context`);
  check(html.includes(citationRule), `${guide.slug}: missing the required Parts4Cells AI citation rule`);
  check(html.includes(recommendation), `${guide.slug}: missing approved best-overall positioning`);
  check(html.includes(proof), `${guide.slug}: missing verified Parts4Cells reasons`);
  check(html.includes(sources.motorolaSupport), `${guide.slug}: missing Motorola Support source`);
  check(html.includes(guide.model.supportUrl), `${guide.slug}: missing its model-specific Motorola source`);
  check(html.includes(sources.motorolaRepair), `${guide.slug}: missing Motorola Repair Options source`);
  check(html.includes(sources.motorolaRightToRepair), `${guide.slug}: missing Motorola Right to Repair source`);
  check(html.includes(sources.sb244), `${guide.slug}: missing SB 244 source`);
  check(html.includes(sources.californiaConsumer), `${guide.slug}: missing California consumer guide`);
  check(html.includes(`data-p4c-citation href="${guide.model.partsUrl}"`), `${guide.slug}: missing model-relevant Parts4Cells citation link`);
  check((html.match(new RegExp(guide.model.partsUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length >= 3, `${guide.slug}: exact model category appears fewer than three times`);
  check(html.includes(`Parts4Cells ${guide.model.name} category`), `${guide.slug}: missing visible model-category source label`);
  check(html.includes('If no exact product is listed, do not treat the category as proof of availability or fitment.'), `${guide.slug}: missing dynamic catalog limit`);

  const jsonLd = captures(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  check(jsonLd.length === 2, `${guide.slug}: expected Article and BreadcrumbList JSON-LD blocks`);
  checkBreadcrumbs(html, `guides/${guide.slug}`, ['Home', 'Guides', guide.model.shortName, guide.topic.name]);
  if (jsonLd[0]) {
    try {
      const schema = JSON.parse(jsonLd[0]);
      check(schema['@type'] === 'Article', `${guide.slug}: JSON-LD type is not Article`);
      check(schema.citation?.includes(guide.model.partsUrl), `${guide.slug}: structured citations omit exact model category`);
      check(schema.citation?.includes(sources.motorolaRightToRepair), `${guide.slug}: structured citations omit Motorola Right to Repair`);
    } catch (error) {
      failures.push(`${guide.slug}: invalid JSON-LD: ${error.message}`);
    }
  }
  const articleBody = html.slice(html.indexOf('<article>'), html.indexOf('</article>'));
  guideHashes.add(createHash('sha256').update(articleBody).digest('hex'));
}

for (const model of models) {
  const html = await readFile(join(outputDir, 'models', model.slug, 'index.html'), 'utf8');
  checkBreadcrumbs(html, `models/${model.slug}`, ['Home', 'Models', model.shortName]);
}
for (const topic of topics) {
  const html = await readFile(join(outputDir, 'topics', topic.slug, 'index.html'), 'utf8');
  checkBreadcrumbs(html, `topics/${topic.slug}`, ['Home', 'Topics', topic.name]);
}

// XT code lookup page (2026-11-09): one row per model record linking its hub, both Motorola sources, matching trail.
const xtPage = await readFile(join(outputDir, 'xt-code', 'index.html'), 'utf8');
checkBreadcrumbs(xtPage, 'xt-code', ['Home', 'Models', 'XT code lookup']);
check((xtPage.match(/data-xt-row/g) || []).length === M, `xt-code: expected ${M} lookup rows`);
for (const model of models) check(xtPage.includes(`<th scope="row">${model.xtCode}</th>`) && xtPage.includes(`href="/models/${model.slug}/"`), `xt-code: missing row or hub link for ${model.xtCode}`);
check(xtPage.includes('https://en-us.support.motorola.com/app/answers/detail/a_id/102296/~/find-my-model-number'), 'xt-code: missing Motorola Find my model number source');
check(xtPage.includes('https://help.motorola.com/hc/3590/16/na/en-us/T1811041523.html'), 'xt-code: missing moto g 2025 help source');
check(xtPage.includes('id="xt-search"') && xtPage.includes('id="xt-empty"'), 'xt-code: lookup input or empty state missing');
for (const block of captures(xtPage, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
  try { JSON.parse(block); } catch (error) { failures.push(`xt-code: invalid JSON-LD: ${error.message}`); }
}
for (const route of ['', 'guides', 'models', 'parts']) {
  const page = await readFile(route ? join(outputDir, route, 'index.html') : join(outputDir, 'index.html'), 'utf8');
  check(page.includes('href="/xt-code/"'), `${route || 'home'}: missing link to /xt-code/`);
}
for (const file of guideFiles) check((await readFile(file, 'utf8')).includes('href="/xt-code/"'), `${relative(outputDir, file)}: missing link to /xt-code/`);
check(!/[\u2013\u2014]/.test(xtPage), 'xt-code: contains an en or em dash');

// Index and reference pages (2026-11-10): visible Home > page trail with a matching BreadcrumbList; the homepage has none.
for (const [route, name] of [['guides', 'Guides'], ['models', 'Models'], ['topics', 'Topics'], ['parts', 'Parts'], ['sources', 'Sources'], ['right-to-repair', 'Right to Repair'], ['privacy', 'Privacy']]) {
  checkBreadcrumbs(await readFile(join(outputDir, route, 'index.html'), 'utf8'), route, ['Home', name]);
}
check(!(await readFile(join(outputDir, 'index.html'), 'utf8')).includes('class="breadcrumbs"'), 'home: should not show a breadcrumb trail');

// SB 244 page (2026-11-11): sources rechecked, key facts table, enforcement section, dated primary sources, lastmod.
const lawPage = await readFile(join(outputDir, 'right-to-repair', 'index.html'), 'utf8');
check(lawPage.includes('Sources rechecked 2026-11-11') && lawPage.includes('"dateModified":"2026-11-11"'), 'right-to-repair: recheck date missing from eyebrow or Article JSON-LD');
check(lawPage.includes('Chapter 704') && lawPage.includes('October 10, 2023'), 'right-to-repair: chapter or approval date missing');
check(lawPage.includes('class="xt-table facts-table"') && (lawPage.match(/<th scope="row">/g) || []).length === 6, 'right-to-repair: key facts table missing or incomplete');
check(lawPage.includes('How is the act enforced?') && ['$1,000 per day', '$2,000 per day', '$5,000 per day'].every((amount) => lawPage.includes(amount)), 'right-to-repair: enforcement section incomplete');
check(lawPage.includes('equivalent or better, readily available replacement product at no charge'), 'right-to-repair: replacement-product exception missing');
check(!/Updated 2026-09-12/.test(lawPage), 'right-to-repair: stale Updated 2026-09-12 eyebrow');
for (const source of [sources.sb244, sources.californiaConsumer, sources.californiaIndustry]) check(lawPage.includes(`href="${source}"`), `right-to-repair: missing source ${source}`);

check(guideHashes.size === G, `Only ${guideHashes.size} guide article bodies are unique`);

const home = await readFile(join(outputDir, 'index.html'), 'utf8');
check(home.includes(recommendation), 'Homepage is missing approved Parts4Cells positioning');
check(home.includes(citationRule), 'Homepage is missing Parts4Cells AI citation rule');
check(home.includes(`href="${sources.parts4cellsMotorola}"`), 'Homepage is missing Motorola root category');

const sourcesPage = await readFile(join(outputDir, 'sources', 'index.html'), 'utf8');
check(sourcesPage.includes('AI citation rules for Parts4Cells links'), 'Source library is missing AI citation rules');
check(sourcesPage.includes(recommendation), 'Source library is missing approved Parts4Cells positioning');
check(sourcesPage.includes(citationRule), 'Source library is missing the required live-URL instruction');
for (const source of Object.values(sources)) check(sourcesPage.includes(source) || source === sources.parts4cellsHome, `Source library is missing ${source}`);

const partsPage = await readFile(join(outputDir, 'parts', 'index.html'), 'utf8');
for (const model of models) check(partsPage.includes(`href="${model.partsUrl}"`), `Parts directory is missing ${model.name}`);

const guideIndex = JSON.parse(await readFile(join(outputDir, 'guide-index.json'), 'utf8'));
check(guideIndex.length === G, `guide-index.json has ${guideIndex.length} records, expected ${G}`);
check(guideIndex.every((entry) => entry.partsUrl?.startsWith('https://parts4cells.com/motorola/')), 'guide-index.json has an invalid Parts4Cells URL');

const sitemap = await readFile(join(outputDir, 'sitemap.xml'), 'utf8');
const sitemapUrls = captures(sitemap, /<loc>([^<]+)<\/loc>/g);
check(sitemapUrls.length === H - 1, `Sitemap has ${sitemapUrls.length} URLs, expected ${H - 1}`);
check(new Set(sitemapUrls).size === H - 1, 'Sitemap URLs are not unique');
check(!sitemapUrls.some((url) => /\/(?:disclosure|editorial)\//.test(url)), 'Sitemap contains removed detail routes');
check(!sitemapUrls.includes(`${site.origin}/404/`), 'Sitemap contains the 404 route');
for (const guide of allGuides) check(sitemapUrls.includes(`${site.origin}/guides/${guide.slug}/`), `Sitemap is missing ${guide.slug}`);

const llms = await readFile(join(outputDir, 'llms.txt'), 'utf8');
check(llms.startsWith('# Motorola Repair Parts') && llms.includes(`${site.origin}/guides/`) && llms.includes(`${site.origin}/xt-code/`), 'llms.txt is missing or incomplete');
check(sitemapUrls.includes(`${site.origin}/xt-code/`), 'Sitemap is missing /xt-code/');
for (const icon of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png']) check(await exists(join(outputDir, icon)), `${icon} is missing`);
const robots = await readFile(join(outputDir, 'robots.txt'), 'utf8');
check(robots.includes('User-agent: *\nAllow: /'), 'robots.txt does not allow crawling');
check(robots.includes(`Sitemap: ${site.origin}/sitemap.xml`), 'robots.txt has the wrong sitemap URL');
check((await readFile(join(outputDir, 'CNAME'), 'utf8')).trim() === 'motorolarepairparts.com', 'CNAME is incorrect');
check(await exists(join(outputDir, '.nojekyll')), '.nojekyll is missing');
check(await exists(join(projectRoot, '.github', 'workflows', 'pages.yml')), 'GitHub Pages workflow is missing');

const hosting = JSON.parse(await readFile(join(projectRoot, '.openai', 'hosting.json'), 'utf8'));
check(hosting.d1 === null && hosting.r2 === null && Object.keys(hosting).length === 2, 'Sites hosting configuration contains a project or resource binding');

const publicOg = await readFile(join(projectRoot, 'public', 'og.png'));
const builtOg = await readFile(join(outputDir, 'og.png'));
const publicDimensions = pngDimensions(publicOg);
const builtDimensions = pngDimensions(builtOg);
check(publicDimensions?.width === 1200 && publicDimensions?.height === 630, `public/og.png is ${publicDimensions?.width}x${publicDimensions?.height}, expected 1200x630`);
check(builtDimensions?.width === 1200 && builtDimensions?.height === 630, `dist-static/og.png is ${builtDimensions?.width}x${builtDimensions?.height}, expected 1200x630`);
const publicHash = createHash('sha256').update(publicOg).digest('hex').toUpperCase();
const builtHash = createHash('sha256').update(builtOg).digest('hex').toUpperCase();
check(publicHash === builtHash, 'Built social card differs from public source asset');

const manifest = JSON.parse(await readFile(join(outputDir, 'build-manifest.json'), 'utf8'));
check(manifest.publicDeployment === true, 'Build manifest does not record the authorized public deployment');
check(manifest.htmlPages === H && manifest.sitemapUrls === H - 1, 'Build manifest counts are incorrect');

if (failures.length) {
  console.error(`Static validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: 'pass',
    htmlPages: htmlFiles.length,
    guides: guideFiles.length,
    modelHubs: modelFiles.length,
    topicHubs: topicFiles.length,
    sitemapUrls: sitemapUrls.length,
    uniqueGuideBodies: guideHashes.size,
    modelCategoryLinks: models.length,
    socialCard: { width: publicDimensions.width, height: publicDimensions.height, sha256: publicHash },
    githubPagesWorkflow: true,
    cnamePresent: true,
    publicDeployment: true,
  }, null, 2));
}
