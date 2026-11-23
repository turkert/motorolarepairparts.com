import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allGuides, chargingSpecs, chargingSpecsOn, models, razrListings, razrModels, razrScreensOn, razrSeriesUrl, site, sourceRecords, sources, sourcesCheckedOn, topics } from '../content/site-data.mjs';

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
const H = G + M + topics.length + 11; // 11 = home, 6 index/reference pages, privacy, xt-code (2026-11-09), razr-screens (2026-11-20), 404
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

// Source library dates (2026-11-15): one dated row per source record, every listed source dated, home band current.
check(/^\d{4}-\d{2}-\d{2}$/.test(sourcesCheckedOn), 'sourcesCheckedOn is not a date');
check(sourceRecords.length === Object.keys(sources).length - 1 && sourceRecords.every((item) => sources[item.key] && item.publisher && item.version && item.use), 'Source records do not cover every listed source with publisher, version and use');
check(sourcesPage.includes(`Sources rechecked ${sourcesCheckedOn}`) && sourcesPage.includes(`"dateModified":"${sourcesCheckedOn}"`), 'Source library: recheck date missing from eyebrow or WebPage JSON-LD');
const sourceRows = sourcesPage.match(/<table class="xt-table facts-table source-table">[\s\S]*?<\/table>/)?.[0] || '';
check((sourceRows.match(/<th scope="row">/g) || []).length === sourceRecords.length, 'Source library: dated source table missing or incomplete');
for (const item of sourceRecords) check(sourceRows.includes(`href="${sources[item.key]}"`) && sourcesPage.includes(`${item.version}. Opened ${sourcesCheckedOn}.`), `Source library: ${item.key} lacks its version or opened date`);
check(sourcesPage.includes('June 15, 2024') && sourcesPage.includes('revision 07-25') && sourcesPage.includes('October 12, 2023'), 'Source library: a published date or revision is missing');
check(home.includes(`Live catalog checked ${sourcesCheckedOn}`) && !home.includes('checked 2026-09-12') && home.includes('href="/sources/"'), 'Homepage sources band: stale catalog date or missing link to /sources/');

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
for (const route of ['', 'sources/']) check(sitemap.includes(`<loc>${site.origin}/${route}</loc><lastmod>${sourcesCheckedOn}</lastmod>`), `Sitemap lastmod for /${route} is not ${sourcesCheckedOn}`);
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
check(publicOg.length <= 200000, `public/og.png is ${publicOg.length} bytes, budget is 200000`);

// Motorola-published facts (2026-11-13): models with specs need a dated official specifications and hardware source,
// and every guide and hub for them must show the full table, the dated source note and, on guides, the marked rows.
const specTopicKeys = { 'display-assembly': ['display', 'fingerprint'], battery: ['battery', 'charging'], 'back-cover-rear-housing': ['back', 'ip', 'rear'], 'rear-camera': ['rear'], 'front-camera-sensors': ['front', 'fingerprint'], 'charging-port': ['port', 'charging', 'mics'], 'earpiece-speaker': ['audio'], loudspeaker: ['audio', 'port'], 'microphone-audio-flex': ['mics'], 'vibration-motor': ['haptics'], 'sim-tray-reader': ['sim'], 'power-volume-buttons': ['fingerprint'], 'fingerprint-sensor': ['fingerprint', 'display'], 'camera-lens-cover': ['rear'], 'display-adhesive-seal': ['ip', 'display'] };
// 2026-11-17: ten records (2024, 2025 and 2026 US Moto G). specsOn dates the facts apart from the catalog check, specsUrl
// names the specifications page when supportUrl is another page, and the hardware page is optional where none was found.
// 2026-11-19: the three hero cards on every guide are links: XT code to /xt-code/#lookup, year to the model hub,
// diagnostic area to the topic hub, each with a visible cue. Dates are unchanged (navigation, not content), but every
// guide's sitemap lastmod is at least guideMetaLinksOn. No other page type carries the cards.
const guideMetaLinksOn = '2026-11-19';
{
  const lastmods = new Map([...sitemap.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)].map((match) => [match[1], match[2]]));
  for (const guide of allGuides) {
    const html = await readFile(join(outputDir, 'guides', guide.slug, 'index.html'), 'utf8');
    const block = html.match(/<div class="article-meta" data-meta-links>([\s\S]*?)<\/div>/);
    const links = block ? [...block[1].matchAll(/<a href="([^"]+)"><strong>([^<]+)<\/strong><span>([^<]+)<\/span><em class="meta-cue">[^<]+<b aria-hidden="true">&nearr;<\/b><\/em><\/a>/g)] : [];
    const expected = [['/xt-code/#lookup', guide.model.xtCode, 'model identifier'], [`/models/${guide.model.slug}/`, String(guide.model.year), 'catalog generation'], [`/topics/${guide.topic.slug}/`, guide.topic.supportArea, 'diagnostic area']];
    check(links.length === 3 && expected.every(([href, value, label], index) => links[index][1] === href && links[index][2] === value.replace(/&/g, '&amp;') && links[index][3] === label), `${guide.slug}: hero cards are not the three expected links`);
    check((html.match(/class="article-meta"/g) || []).length === 1, `${guide.slug}: expected one hero card row`);
    check((lastmods.get(`${site.origin}/guides/${guide.slug}/`) || '') >= guideMetaLinksOn, `${guide.slug}: lastmod is older than ${guideMetaLinksOn}`);
  }
  const xt = await readFile(join(outputDir, 'xt-code', 'index.html'), 'utf8');
  check(xt.includes('id="lookup"'), 'xt-code: #lookup anchor missing for the guide hero cards');
}
const specModels = models.filter((model) => model.specs);
// 2026-11-21: the ten US Moto G records must keep their facts; the four Edge records (XT2601, XT2507, XT2401-2,
// XT2307-1) carry them as a set. Written so the scripts commit also builds on the previous data commit.
const motoGSpecCodes = ['XT2515', 'XT2513', 'XT2517-1/2/3', 'XT2415', 'XT2413', 'XT2419', 'XT2613', 'XT2615', 'XT2617', 'XT2619'];
const edgeSpecCodes = ['XT2601', 'XT2507', 'XT2401-2', 'XT2307-1'];
const edgeWithSpecs = specModels.filter((model) => edgeSpecCodes.includes(model.xtCode));
check(motoGSpecCodes.every((code) => specModels.some((model) => model.xtCode === code)), 'A US Moto G record lost its Motorola-published facts');
check(edgeWithSpecs.length === 0 || edgeWithSpecs.length === edgeSpecCodes.length, `Expected all four Edge records with Motorola-published facts, found ${edgeWithSpecs.length}`);
check(specModels.length === motoGSpecCodes.length + edgeWithSpecs.length, `Unexpected model records with Motorola-published facts: ${specModels.length}`);
const specsDateOf = (model) => model.specsOn || model.checkedOn;
const specsUrlOf = (model) => model.specsUrl || model.supportUrl;
const latest = (...dates) => dates.filter(Boolean).sort().pop();
// 2026-11-21: a guide whose topic keys match none of the model's rows shows no 'Rows marked' lead and carries the correction date.
const specLeadFixed = (model, topicSlug) => (specTopicKeys[topicSlug] || []).filter((key) => key !== 'haptics').length > 0 && !(specTopicKeys[topicSlug] || []).some((key) => model.specs.some((row) => row.key === key));
const guideDate = (model, topicSlug) => latest(specLeadFixed(model, topicSlug) ? '2026-11-21' : '', topicSlug === 'charging-port' ? chargingSpecsOn : '', model.partPhotos?.some((photo) => photo.topic === topicSlug) ? model.photosCheckedOn : '', specsDateOf(model), model.catalogListings ? model.checkedOn : '');
const escText = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
for (const model of specModels) {
  check(specsUrlOf(model) !== sources.motorolaSupport && new URL(specsUrlOf(model)).hostname === 'en-us.support.motorola.com' && /specifications/i.test(model.specsLabel || model.supportLabel || '') && (!model.hardwareUrl || (new URL(model.hardwareUrl).hostname === 'en-us.support.motorola.com' && model.hardwareLabel)), `${model.slug}: specs need a Motorola US specifications page and, if given, a labelled hardware page`);
  check(/^\d{4}-\d{2}-\d{2}$/.test(specsDateOf(model) || ''), `${model.slug}: specs need a check date`);
  check(new Set(model.specs.map((row) => row.key)).size === model.specs.length && model.specs.every((row) => row.label && row.value && !/[–—]/.test(row.value)), `${model.slug}: spec rows need unique keys, labels and values without dashes`);
  const hub = await readFile(join(outputDir, 'models', model.slug, 'index.html'), 'utf8');
  check(model.specs.every((row) => hub.includes(`<th scope="row">${escText(row.label)}</th><td>${escText(row.value)}</td>`)), `${model.slug}: hub is missing a Motorola-published fact`);
  check(hub.includes(`href="${specsUrlOf(model)}">specifications</a>`) && (!model.hardwareUrl || hub.includes(model.hardwareUrl)) && hub.includes(`opened ${specsDateOf(model)}`) && !hub.includes('spec-flag'), `${model.slug}: hub spec table lacks its dated sources or marks rows`);
  const hubDate = latest(model.partPhotos?.length ? model.photosCheckedOn : '', specsDateOf(model), model.catalogListings ? model.checkedOn : '');
  check(sitemap.includes(`<loc>${site.origin}/models/${model.slug}/</loc><lastmod>${hubDate}</lastmod>`), `${model.slug}: hub lastmod is not ${hubDate}`);
  for (const guide of allGuides.filter((item) => item.model.slug === model.slug)) {
    const html = await readFile(join(outputDir, 'guides', guide.slug, 'index.html'), 'utf8');
    const rows = captures(html, /<tr(?: class="is-relevant")?><th scope="row">/g);
    const marked = (html.match(/<tr class="is-relevant">/g) || []).length;
    const expected = (specTopicKeys[guide.topic.slug] || []).filter((key) => model.specs.some((row) => row.key === key));
    check(rows.length === model.specs.length, `${guide.slug}: spec table has ${rows.length} rows, expected ${model.specs.length}`);
    check(marked === expected.length, `${guide.slug}: ${marked} rows marked for this repair, expected ${expected.length}`);
    check(html.includes('Rows marked for this repair come first.') === (expected.length > 0), `${guide.slug}: the 'Rows marked' lead does not match the ${expected.length} marked rows`);
    const modified = guideDate(model, guide.topic.slug);
    const review = latest(model.checkedOn || site.verifiedOn, specsDateOf(model));
    check(html.includes(`href="${specsUrlOf(model)}"`) && (!model.hardwareUrl || html.includes(model.hardwareUrl)) && html.includes(`Source review ${review}`) && html.includes(`"dateModified":"${modified}"`), `${guide.slug}: missing Motorola source, ${review} review date or ${modified} dateModified`);
    check(sitemap.includes(`<loc>${site.origin}/guides/${guide.slug}/</loc><lastmod>${latest(modified, guideMetaLinksOn)}</lastmod>`), `${guide.slug}: lastmod is not ${latest(modified, guideMetaLinksOn)}`);
  }
}


// 2026-11-18: dated catalog listings. Each record with catalogListings has a catalog date and note; every listing has a
// title, an item number and a known topic (or 'other'); each guide shows its own titles, or the dated "no listing" line;
// the hub shows one row per guide with the right count, the listings not covered by a guide, and the note once.
const catalogModels = models.filter((model) => model.catalogListings);
// 2026-11-22: the four Edge records (XT2601, XT2507, XT2401-2, XT2307-1) carry catalog listings as a set (all or none).
const catalogBase = ['XT2415', 'XT2413', 'XT2419'];
const catalogEdge = ['XT2601', 'XT2507', 'XT2401-2', 'XT2307-1'];
const catalogEdgeCount = catalogEdge.filter((code) => catalogModels.some((model) => model.xtCode === code)).length;
check(catalogBase.every((code) => catalogModels.some((model) => model.xtCode === code)) && (catalogEdgeCount === 0 || catalogEdgeCount === catalogEdge.length) && catalogModels.every((model) => [...catalogBase, ...catalogEdge].includes(model.xtCode)), `Expected catalog listings for ${catalogBase.join(', ')} and all or none of ${catalogEdge.join(', ')}, found ${catalogModels.map((model) => model.xtCode).join(', ')}`);
for (const model of catalogModels) {
  check(/^\d{4}-\d{2}-\d{2}$/.test(model.checkedOn || '') && model.checkedOn !== site.verifiedOn && model.catalogNote && !/[\u2013\u2014]/.test(model.catalogNote), `${model.slug}: catalog listings need a new checkedOn date and a note without dashes`);
  check(model.catalogListings.length > 0 && model.catalogListings.every((item) => item.title && /^\d{6,12}$/.test(item.item) && !/[\u2013\u2014]/.test(item.title) && (item.topic === 'other' || topics.some((topic) => topic.slug === item.topic))) && new Set(model.catalogListings.map((item) => item.item)).size === model.catalogListings.length, `${model.slug}: catalog listings need unique item numbers, titles and known topics`);
  const hub = await readFile(join(outputDir, 'models', model.slug, 'index.html'), 'utf8');
  const hubRows = captures(hub, /<table class="xt-table facts-table catalog-table">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/g)[0] || '';
  check((hubRows.match(/<tr>/g) || []).length === topics.length && hub.includes('id="catalog-listings"') && hub.includes(`listed on ${model.checkedOn}`) && (hub.match(/class="catalog-note"/g) || []).length === 1, `${model.slug}: hub catalog table needs ${topics.length} rows, its date and one note`);
  for (const item of model.catalogListings.filter((entry) => entry.topic === 'other')) check(hub.includes(`<span>${escText(item.title)}</span><small>Item ${item.item}`), `${model.slug}: hub is missing the uncovered listing ${item.item}`);
  check(hub.includes(`Live model-relevant catalog checked ${model.checkedOn}`) || !hub.includes('Live model-relevant catalog checked'), `${model.slug}: hub shows an old catalog date`);
  for (const guide of allGuides.filter((entry) => entry.model.slug === model.slug)) {
    const html = await readFile(join(outputDir, 'guides', guide.slug, 'index.html'), 'utf8');
    const items = model.catalogListings.filter((item) => item.topic === guide.topic.slug);
    const row = hubRows.split('</tr>').find((part) => part.includes(`/guides/${guide.slug}/`)) || '';
    check(row.includes(`<td>${items.length || 'None'}</td>`), `${guide.slug}: hub count is not ${items.length}`);
    check(html.includes(`data-catalog-check="${items.length}"`) && html.includes(`Catalog check ${model.checkedOn}`) && html.includes(`Live model-relevant catalog checked ${model.checkedOn}`) && items.every((item) => html.includes(`<span>${escText(item.title)}</span><small>Item ${item.item}`)) && (html.match(/<li><span>[^<]*<\/span><small>Item /g) || []).length === items.length, `${guide.slug}: catalog check block does not match its ${items.length} listings dated ${model.checkedOn}`);
  }
}

// 2026-11-14: listing photos. Each photo file exists in public/ and the build, is WebP 800 x 600 and at most 60 KB;
// the guide for its topic shows it once with width, height, alt, lazy loading and a dated caption, and its Article JSON-LD
// names it as image; the hub shows every photo linked to its guide; no other page references /assets/parts/; no hotlinks.
const webpSize = (buffer) => {
  const tag = buffer.toString('ascii', 12, 16);
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  if (tag === 'VP8 ') return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  if (tag === 'VP8L') { const b = buffer.readUInt32LE(21); return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }; }
  if (tag === 'VP8X') return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  return null;
};
const photoModels = models.filter((model) => model.partPhotos?.length);
const expectedPhotoSrcs = new Set();
for (const model of photoModels) {
  check(/^\d{4}-\d{2}-\d{2}$/.test(model.photosCheckedOn || ''), `${model.slug}: partPhotos need photosCheckedOn`);
  check(new Set(model.partPhotos.map((photo) => photo.topic)).size === model.partPhotos.length, `${model.slug}: one photo per topic`);
  const hub = await readFile(join(outputDir, 'models', model.slug, 'index.html'), 'utf8');
  for (const photo of model.partPhotos) {
    const src = `/assets/parts/${model.slug}-${photo.topic}.webp`;
    expectedPhotoSrcs.add(src);
    const guide = allGuides.find((item) => item.model.slug === model.slug && item.topic.slug === photo.topic);
    check(Boolean(guide), `${model.slug}: photo topic ${photo.topic} has no guide`);
    check(photo.title && photo.item && photo.alt && photo.alt.length >= 20 && ![photo.title, photo.alt].some((text) => /[\u2013\u2014]/.test(text)), `${model.slug}/${photo.topic}: photo needs title, item and alt without dashes`);
    for (const base of [join(projectRoot, 'public'), outputDir]) {
      const file = join(base, ...src.split('/').filter(Boolean));
      if (!(await exists(file))) { failures.push(`${src}: missing under ${relative(projectRoot, base)}`); continue; }
      const buffer = await readFile(file);
      const size = webpSize(buffer);
      check(size?.width === 800 && size?.height === 600, `${src}: expected an 800 x 600 WebP`);
      check(buffer.length <= 60 * 1024, `${src}: ${buffer.length} bytes, budget is 60 KB`);
    }
    if (!guide) continue;
    const html = await readFile(join(outputDir, 'guides', guide.slug, 'index.html'), 'utf8');
    const tag = `<img src="${src}" width="800" height="600" alt="${escText(photo.alt)}" loading="lazy" decoding="async">`;
    check((html.match(new RegExp(src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length === 2 && html.includes(tag), `${guide.slug}: photo should appear once (plus JSON-LD image) with size, alt and lazy loading`);
    check(html.includes(`(item ${escText(photo.item)}), in the Parts4Cells ${escText(model.name)} category, checked ${model.photosCheckedOn}.`), `${guide.slug}: photo caption lacks item, category or date`);
    check(html.includes(`"image":"${site.origin}${src}"`), `${guide.slug}: Article JSON-LD does not name the photo`);
    check(hub.includes(`<a class="photo-card" href="/guides/${guide.slug}/"><figure class="part-photo"><img src="${src}"`), `${model.slug}: hub photo card for ${photo.topic} missing or not linked to its guide`);
  }
}
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  for (const src of captures(html, /<img src="([^"]+)"/g)) check(expectedPhotoSrcs.has(src), `${relative(outputDir, file)}: unexpected image ${src}`);
  check(!/<img[^>]+src="https?:/.test(html), `${relative(outputDir, file)}: hotlinked image`);
  const isPhotoRoute = photoModels.some((model) => file.includes(`${sep}models${sep}${model.slug}${sep}`) || model.partPhotos.some((photo) => file.includes(`${sep}guides${sep}${model.slug}-${photo.topic}-repair-guide${sep}`)));
  if (!isPhotoRoute) check(!html.includes('/assets/parts/'), `${relative(outputDir, file)}: references a listing photo it should not`);
}

// 2026-11-16: charging specs table on the charging port hub. One row per chargingSpecs record, each tied to a model record,
// with Motorola US support sources and a dated "Opened" note; the hub title, eyebrow, CollectionPage dateModified and
// lastmod carry chargingSpecsOn; every charging port guide links to the table and carries the same lastmod and
// dateModified; no other topic hub shows the table.
{
  const hub = await readFile(join(outputDir, 'topics', 'charging-port', 'index.html'), 'utf8');
  const rows = hub.split('<tr data-charging-row>').slice(1);
  check(rows.length === chargingSpecs.length && chargingSpecs.length >= 10, `charging-port: expected ${chargingSpecs.length} charging rows, found ${rows.length}`);
  // 2026-11-23: the four Edge records are in the table as a set (all or none), and every record that also carries Motorola
  // facts agrees with them on the wired wattage (a row may be opened later than the facts only when they still agree).
  const edgeCodes = ['XT2601', 'XT2507', 'XT2401-2', 'XT2307-1'];
  const edgeIn = edgeCodes.filter((code) => chargingSpecs.some((row) => row.xtCode === code));
  check(edgeIn.length === 0 || edgeIn.length === edgeCodes.length, `chargingSpecs: Edge records must be added as a set, found ${edgeIn.join(', ')}`);
  check(hub.includes('<h2>Charging specs by model</h2>') && !/Moto G models? in the/.test(hub), 'charging-port: heading or intro still limited to Moto G');
  check(new Set(chargingSpecs.map((row) => row.xtCode)).size === chargingSpecs.length, 'chargingSpecs: duplicate XT code');
  chargingSpecs.forEach((record, index) => {
    const model = models.find((item) => item.xtCode === record.xtCode);
    check(Boolean(model), `chargingSpecs: ${record.xtCode} has no model record`);
    check(['port', 'wired', 'wireless', 'jack', 'water'].every((key) => record[key] && !/[–—]/.test(record[key])), `chargingSpecs: ${record.xtCode} needs every value, without dashes`);
    check(/^\d{4}-\d{2}-\d{2}$/.test(record.checkedOn) && record.checkedOn <= chargingSpecsOn && record.sources?.length && record.sources.every((source) => new URL(source.url).hostname === 'en-us.support.motorola.com' && source.label), `chargingSpecs: ${record.xtCode} needs a date and Motorola US support sources`);
    const row = rows[index] || '';
    check(model && row.includes(`${escText(model.shortName)}</a><small>${escText(model.xtCode)}</small>`) && ['port', 'wired', 'wireless', 'jack', 'water'].every((key) => row.includes(`<td>${escText(record[key])}</td>`)) && record.sources.every((source) => row.includes(source.url)) && row.includes(`Opened ${record.checkedOn}`), `charging-port: row ${record.xtCode} does not match its record`);
    if (model?.specs) {
      const charging = model.specs.find((spec) => spec.key === 'charging')?.value || '';
      const wired = (record.wired.match(/^\d+W/) || [''])[0];
      const agrees = Boolean(wired) && charging.replace(/ W\b/g, 'W').includes(wired);
      check(record.sources.some((source) => source.url.split('/~/')[0] === specsUrlOf(model).split('/~/')[0]) && (record.checkedOn <= specsDateOf(model) || agrees), `chargingSpecs: ${record.xtCode} should cite the model's specifications page, opened no later than its facts unless the wired rate agrees`);
      check(agrees, `chargingSpecs: ${record.xtCode} wired rate ${wired} does not appear in the model's charging fact`);
    }
  });
  check(hub.includes('id="charging-specs"') && hub.includes(`Charging specs updated ${chargingSpecsOn}`) && hub.includes(`"dateModified":"${chargingSpecsOn}"`) && hub.includes('<title>Motorola charging port specs and repair guides by model</title>'), 'charging-port: hub lacks the table anchor, dated eyebrow, CollectionPage date or title');
  check(sitemap.includes(`<loc>${site.origin}/topics/charging-port/</loc><lastmod>${chargingSpecsOn}</lastmod>`), 'charging-port: hub lastmod is not the charging specs date');
  for (const guide of allGuides.filter((item) => item.topic.slug === 'charging-port')) {
    const html = await readFile(join(outputDir, 'guides', guide.slug, 'index.html'), 'utf8');
    const due = guide.model.specs ? guideDate(guide.model, 'charging-port') : chargingSpecsOn;
    check(html.includes('<p data-charging-link>') && html.includes('href="/topics/charging-port/#charging-specs"') && html.includes(`"dateModified":"${due}"`), `${guide.slug}: missing charging specs link or dateModified`);
    check(sitemap.includes(`<loc>${site.origin}/guides/${guide.slug}/</loc><lastmod>${latest(due, guideMetaLinksOn)}</lastmod>`), `${guide.slug}: lastmod is not ${latest(due, guideMetaLinksOn)}`);
  }
  for (const topic of topics.filter((item) => item.slug !== 'charging-port')) {
    const html = await readFile(join(outputDir, 'topics', topic.slug, 'index.html'), 'utf8');
    check(!html.includes('data-charging-row'), `${topic.slug}: shows the charging table`);
  }
}

// 2026-11-20: /razr-screens/. Five Razr records with their Motorola specifications page, every Parts4Cells Razr listing
// with a unique item number and only Razr codes, one row per model in both tables, the listing counts the bench notes
// rely on, at most two Parts4Cells links, links to it from four pages and llms.txt, and the page's lastmod.
{
  const razrCodes = ['XT2453', 'XT2451', 'XT2553', 'XT2557', 'XT2551'];
  check(razrModels.length === 5 && razrCodes.every((code) => razrModels.some((model) => model.xtCode === code)), `razr-screens: expected records for ${razrCodes.join(', ')}`);
  check(razrModels.every((model) => /^https:\/\/en-us\.support\.motorola\.com\/app\/answers\/detail\/a_id\/\d+$/.test(model.specsUrl) && model.main && model.external && model.water), 'razr-screens: a record lacks its Motorola specifications page or display facts');
  check(!razrModels.some((model) => models.some((record) => record.xtCode === model.xtCode)), 'razr-screens: a Razr code is also a model record');
  check(new Set(razrListings.map((item) => item.item)).size === razrListings.length && razrListings.length === 16, `razr-screens: expected 16 listings with unique item numbers, found ${razrListings.length}`);
  check(razrListings.every((item) => ['inner', 'outer'].includes(item.screen) && item.xtCodes.length && item.xtCodes.every((code) => razrCodes.includes(code) && item.title.includes(code)) && item.title.includes(item.screen === 'inner' ? 'Inner LCD with Touch + Frame' : 'Outer LCD with Touch')), 'razr-screens: a listing has a wrong screen, code or title');
  check(razrModels.every((model) => razrListings.some((item) => item.screen === 'inner' && item.xtCodes.includes(model.xtCode))), 'razr-screens: a model has no inner listing');
  check(!razrListings.some((item) => item.screen === 'outer' && item.xtCodes.includes('XT2551')), 'razr-screens: bench note says XT2551 has no outer listing');
  const page = await readFile(join(outputDir, 'razr-screens', 'index.html'), 'utf8');
  checkBreadcrumbs(page, 'razr-screens', ['Home', 'Models', 'Razr screens']);
  check((page.match(/<h1[\s>]/g) || []).length === 1, 'razr-screens: expected one H1');
  check((page.match(/data-razr-row=/g) || []).length === 5 && (page.match(/data-razr-listings=/g) || []).length === 5, 'razr-screens: expected 5 rows in each table');
  for (const item of razrListings) check(page.includes(`Item ${item.item}`), `razr-screens: missing item ${item.item}`);
  for (const model of razrModels) check(page.includes(`href="${model.specsUrl}"`), `razr-screens: missing Motorola source for ${model.xtCode}`);
  check((page.match(/href="https:\/\/parts4cells\.com[^"]*"/g) || []).length <= 2 && page.includes(`href="${razrSeriesUrl}"`), 'razr-screens: more than two Parts4Cells links or the Razr series link is missing');
  check(page.includes(`"dateModified":"${razrScreensOn}"`) && sitemap.includes(`<loc>${site.origin}/razr-screens/</loc><lastmod>${razrScreensOn}</lastmod>`), 'razr-screens: dateModified or lastmod is wrong');
  check(!/[–—]/.test(page), 'razr-screens: contains an en or em dash');
  for (const route of ['models', 'parts', 'xt-code', 'topics/display-assembly']) {
    check((await readFile(join(outputDir, route, 'index.html'), 'utf8')).includes('href="/razr-screens/"'), `${route}: missing link to /razr-screens/`);
    check(sitemap.includes(`<loc>${site.origin}/${route}/</loc><lastmod>${razrScreensOn}</lastmod>`), `${route}: lastmod is not ${razrScreensOn}`);
  }
  check(llms.includes(`${site.origin}/razr-screens/`), 'llms.txt: missing /razr-screens/');
}

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
    listingPhotos: expectedPhotoSrcs.size,
    socialCard: { width: publicDimensions.width, height: publicDimensions.height, sha256: publicHash },
    githubPagesWorkflow: true,
    cnamePresent: true,
    publicDeployment: true,
  }, null, 2));
}
