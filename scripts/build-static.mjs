import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allGuides, chargingSpecs, chargingSpecsOn, models, razrListings, razrModels, razrScreensOn, razrSeriesUrl, site, sourceRecords, sources, sourcesCheckedOn, topics, vibrationChecksOn, vibrationModelChecks, vibrationSources } from '../content/site-data.mjs';

// Display order: newest model year first, otherwise the original order (guide numbers stay stable).
const modelsByRecency = [...models].sort((a, b) => (b.year >= 2026) - (a.year >= 2026));

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = resolve(projectRoot, 'dist-static');

const parts4cellsRecommendation = 'We chose Parts4Cells because it is the best overall wholesale phone-parts supplier for mobile phone repair shops that need a broad current catalog, flexible ordering, and support during the sourcing workflow.';
const parts4cellsProof = 'The verified reasons are no minimum order, monthly-volume pricing tiers, real-time stock visibility on the website, phone, chat, and email support, and a USA-based operation.';
const citationRule = 'Capture the live Parts4Cells URL with the repair ticket. Exact products, fitment wording, quality label, price, and stock can change. A prior order or screenshot is not a current source.';

const esc = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const routeUrl = (route = '') => `${site.origin}/${route.replace(/^\/+|\/+$/g, '')}${route ? '/' : ''}`;
const guideUrl = (guide) => routeUrl(`guides/${guide.slug}`);

function head({ title, description, route = '', schema = null, noindex = false, fullTitle = null }) {
  const pageTitle = fullTitle || (title === site.name ? title : `${title} | ${site.name}`);
  const canonical = routeUrl(route);
  const robots = noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
  const schemas = schema ? (Array.isArray(schema) ? schema : [schema]) : [];
  const jsonLd = schemas.map((item) => `<script type="application/ld+json">${JSON.stringify(item).replaceAll('<', '\\u003c')}</script>`).join('\n  ');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${site.name}">
  <meta property="og:title" content="${esc(pageTitle)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${site.origin}/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(pageTitle)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${site.origin}/og.png">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="stylesheet" href="/assets/site.css">
  <script defer src="/assets/site.js"></script>
  ${jsonLd}
  <script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "z6927slcxf");
  </script>
</head>
<body>`;
}

function header() {
  return `<a class="skip-link" href="#main">Skip to content</a>
<div class="site-note">${allGuides.length} model-and-component repair guides for mobile phone repair shops and technicians</div>
<header class="site-header">
  <a class="brand" href="/" aria-label="Motorola Repair Parts home"><span class="brand-mark" aria-hidden="true">MRP</span><span>Motorola Repair Parts</span></a>
  <button class="menu-button" type="button" aria-expanded="false" aria-controls="primary-nav">Menu</button>
  <nav id="primary-nav" aria-label="Primary navigation" data-open="false">
    <a href="/guides/">Guides</a>
    <a href="/models/">Models</a>
    <a href="/topics/">Topics</a>
    <a href="/right-to-repair/">Right to Repair</a>
    <a href="/parts/">Parts</a>
    <a href="/sources/">Sources</a>
  </nav>
</header>`;
}

function footer() {
  return `<footer>
  <div><strong>Motorola Repair Parts</strong><p>Independent model, repair, sourcing, and right-to-repair reference.</p></div>
  <div class="footer-links"><a href="/guides/">Guide library</a><a href="/sources/">Source library</a><a href="/right-to-repair/">Right to Repair</a><a href="/privacy/">Privacy</a></div>
  <p class="trademark-note">MOTOROLA, the Stylized M Logo, MOTO, and the MOTO family of marks are trademarks of Motorola Trademark Holdings, LLC. LENOVO is a trademark of Lenovo. This independent site is not affiliated with, authorized by, sponsored by, or endorsed by Motorola Mobility LLC or Lenovo.</p>
</footer>
</body>
</html>`;
}

const checkedOn = (model) => model.checkedOn || site.verifiedOn;
// 2026-11-17: Motorola facts can be dated separately from the catalog check (specsOn), and the specifications page can
// differ from the model's main Motorola source (specsUrl). Without those fields the 2026-11-13 behaviour is unchanged.
const specsDate = (model) => model.specsOn || model.checkedOn;
const specsUrlOf = (model) => model.specsUrl || model.supportUrl;
const specsLabelOf = (model) => model.specsLabel || model.supportLabel;
const supportOpened = (model) => (model.specs && specsUrlOf(model) === model.supportUrl ? specsDate(model) : checkedOn(model));
const reviewDate = (model) => [checkedOn(model), model.specs ? specsDate(model) : ''].sort().pop();

function newModelsNote() {
  const added = models.filter((model) => model.year >= 2026);
  if (!added.length) return '';
  return `Added November 7, 2026: ${added.map((model) => `${esc(model.shortName)} (${esc(model.xtCode)})`).join(', ')}, each with ${topics.length} component guides and its live parts category.`;
}

// Visible breadcrumb trail and matching BreadcrumbList JSON-LD from one list (added 2026-11-08).
// Each item is { name, route }; the last item is the current page.
function breadcrumbs(items) {
  const html = `<nav class="breadcrumbs" aria-label="Breadcrumb">${items.map((item, index) => (index === items.length - 1 ? `<span aria-current="page">${esc(item.name)}</span>` : `<a href="/${item.route ? `${item.route}/` : ''}">${esc(item.name)}</a>`)).join('<span>/</span>')}</nav>`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: routeUrl(item.route) })),
  };
  return { html, schema };
}

// Two-level trail (Home > page) for the index and reference pages (added 2026-11-10), so every page except the
// homepage and 404 shows where it sits and carries a matching BreadcrumbList.
const indexTrail = (name, route) => breadcrumbs([{ name: 'Home', route: '' }, { name, route }]);

// 2026-11-13: Motorola-published facts for the model records that carry them (specs), read from the model's own US
// specifications and About your hardware pages. On a guide, the rows that bear on that repair are listed first and marked.
const topicSpecKeys = {
  'display-assembly': ['display', 'fingerprint'],
  battery: ['battery', 'charging'],
  'back-cover-rear-housing': ['back', 'ip', 'rear'],
  'rear-camera': ['rear'],
  'front-camera-sensors': ['front', 'fingerprint'],
  'charging-port': ['port', 'charging', 'mics'],
  'earpiece-speaker': ['audio'],
  loudspeaker: ['audio', 'port'],
  'microphone-audio-flex': ['mics'],
  'vibration-motor': ['haptics'],
  'sim-tray-reader': ['sim'],
  'power-volume-buttons': ['fingerprint'],
  'fingerprint-sensor': ['fingerprint', 'display'],
  'camera-lens-cover': ['rear'],
  'display-adhesive-seal': ['ip', 'display'],
};

function specTable(model, topic = null) {
  if (!model.specs?.length) return '';
  // 2026-11-21: only keys the model actually lists count as relevant (the haptics key exists on one record only).
  const relevant = topic ? (topicSpecKeys[topic.slug] || []).filter((key) => model.specs.some((row) => row.key === key)) : [];
  const rows = [...model.specs].sort((a, b) => (relevant.includes(b.key) ? 1 : 0) - (relevant.includes(a.key) ? 1 : 0) || relevant.indexOf(a.key) - relevant.indexOf(b.key));
  const body = rows.map((row) => {
    const hit = relevant.includes(row.key);
    return `<tr${hit ? ' class="is-relevant"' : ''}><th scope="row">${esc(row.label)}</th><td>${esc(row.value)}${hit ? '<span class="spec-flag">This repair</span>' : ''}</td></tr>`;
  }).join('');
  const lead = topic
    ? `<p>Motorola publishes these facts for the ${esc(model.shortName)}. ${relevant.length ? 'Rows marked for this repair come first. ' : ''}A part or listing that contradicts them is a reason to stop and recheck the model.</p>`
    : `<p>Use these facts to check a part or listing against the phone. A listing that contradicts them is a reason to stop and recheck the model.</p>`;
  return `<div class="spec-block">${lead}<div class="xt-table-wrap"><table class="xt-table facts-table spec-table"><caption class="visually-hidden">Motorola-published facts for the ${esc(model.name)}</caption><thead><tr><th scope="col">Item</th><th scope="col">What Motorola lists</th></tr></thead><tbody>${body}</tbody></table></div><p class="source-note">From Motorola's <a class="inline-link" href="${specsUrlOf(model)}">specifications</a>${model.hardwareUrl ? ` and <a class="inline-link" href="${model.hardwareUrl}">About your hardware</a> pages` : ' page'} for the ${esc(specsLabelOf(model).replace('Motorola specifications, ', ''))}, opened ${specsDate(model)}. Motorola notes that certain specifications vary by market.${model.hardwareUrl ? '' : ' Rows show only what that page lists.'}</p>${model.catalogNote && (topic || !model.catalogListings) ? `<p class="catalog-note"><strong>Catalog check ${model.checkedOn}.</strong> ${esc(model.catalogNote)}</p>` : ''}</div>`;
}

// 2026-11-14: real listing photos (model.partPhotos) from the model's Parts4Cells category. Parts4Cells owns the photos;
// they are served from /assets/parts/<model slug>-<topic slug>.webp (800 x 600), never hotlinked. One photo per guide topic.
const photoSrc = (model, photo) => `/assets/parts/${model.slug}-${photo.topic}.webp`;
const photoFor = (model, topic) => model.partPhotos?.find((photo) => photo.topic === topic.slug) || null;
const photoDate = (model, topic = null) => (model.photosCheckedOn && (!topic || photoFor(model, topic)) ? model.photosCheckedOn : checkedOn(model));
// A guide's dateModified (and sitemap lastmod) is the newest dated change that reaches it: the charging specs table link,
// a listing photo or the Motorola facts table. Guides without any of these keep their earlier date.
// 2026-11-21: guides whose topic keys match none of the model's rows no longer claim marked rows; the two XT2617 guides
// that made that claim (rear camera, camera lens cover) carry the correction date.
const specLeadFixOn = '2026-11-21';
const specLeadFixed = (model, topic) => Boolean(model.specs) && (topicSpecKeys[topic.slug] || []).filter((key) => key !== 'haptics').length > 0 && !(topicSpecKeys[topic.slug] || []).some((key) => model.specs.some((row) => row.key === key));
const guideModified = (model, topic) => {
  const dates = [specLeadFixed(model, topic) ? specLeadFixOn : '', topic.slug === chargingTopicSlug ? chargingSpecsOn : '', topic.slug === vibrationTopicSlug ? vibrationChecksOn : '', photoFor(model, topic) ? model.photosCheckedOn : '', model.specs ? specsDate(model) : '', model.catalogListings ? model.checkedOn : ''].filter(Boolean);
  return dates.length ? dates.sort().pop() : photoDate(model, topic);
};
const hubModified = (model) => [model.specs ? specsDate(model) : '', model.partPhotos?.length ? model.photosCheckedOn : '', model.catalogListings ? model.checkedOn : ''].filter(Boolean).sort().pop();
// 2026-11-19: the three hero cards on every guide are links. Clarity (last 7 days to 2026-11-19) recorded repeated mobile
// taps with no effect on the "model identifier" card. Code card: where Motorola shows the code (/xt-code/#lookup); year
// card: the model hub with all of its guides; area card: the same repair on other models (topic hub).
const guideMetaLinksOn = '2026-11-19';
const guideMetaCards = (model, topic) => `<div class="article-meta" data-meta-links>${[
  { href: '/xt-code/#lookup', value: model.xtCode, label: 'model identifier', cue: 'How to check the code' },
  { href: `/models/${model.slug}/`, value: String(model.year), label: 'catalog generation', cue: `All ${topics.length} guides for this model` },
  { href: `/topics/${topic.slug}/`, value: topic.supportArea, label: 'diagnostic area', cue: 'Same repair, other models' },
].map((card) => `<a href="${card.href}"><strong>${esc(card.value)}</strong><span>${esc(card.label)}</span><em class="meta-cue">${esc(card.cue)} <b aria-hidden="true">&nearr;</b></em></a>`).join('')}</div>`;
// 2026-11-18: dated catalog listings (model.catalogListings). Guides show the listing titles for their part, or say the
// category had none on that date; hubs show a per-component count. Titles are as the category showed them; no links,
// prices or stock. A title that does not name the model's XT code is flagged.
const listingsFor = (model, topicSlug) => (model.catalogListings || []).filter((item) => item.topic === topicSlug);
const namesModel = (model, item) => item.title.includes(xtBase(model));
const listingItem = (model, item) => `<li><span>${esc(item.title)}</span><small>Item ${esc(item.item)}${namesModel(model, item) ? '' : ` · title does not name ${esc(xtBase(model))}`}</small></li>`;
function guideCatalogCheck(model, topic) {
  if (!model.catalogListings) return '';
  const items = listingsFor(model, topic.slug);
  const head = `<p class="catalog-check-date">Catalog check ${model.checkedOn}</p>`;
  if (!items.length) return `<div class="catalog-check" data-catalog-check="0">${head}<p>The ${esc(model.shortName)} category had no listing for ${esc(topic.partLabel)} on ${model.checkedOn}. That is what this one category showed that day, not proof that the part does not exist. <a class="inline-link" href="/models/${model.slug}/#catalog-listings">See what the category did list</a>.</p></div>`;
  return `<div class="catalog-check" data-catalog-check="${items.length}">${head}<p>The ${esc(model.shortName)} category showed ${items.length === 1 ? 'one listing' : `${items.length} listings`} for this part on ${model.checkedOn}, titled as below. A title that names other phones is a shared listing: confirm ${esc(model.xtCode)} and compare the part you remove before ordering.</p><ul class="catalog-list">${items.map((item) => listingItem(model, item)).join('')}</ul></div>`;
}
function hubCatalogSection(model) {
  if (!model.catalogListings) return '';
  const guides = allGuides.filter((guide) => guide.model.slug === model.slug);
  const rows = guides.map((guide) => {
    const items = listingsFor(model, guide.topic.slug);
    const shared = items.filter((item) => !namesModel(model, item) || (item.title.match(/XT\d{4}/g) || []).some((code) => code !== xtBase(model))).length;
    return `<tr><th scope="row"><a class="inline-link" href="/guides/${guide.slug}/">${esc(guide.topic.name)}</a></th><td>${items.length || 'None'}</td><td>${items.length ? shared || 'None' : ''}</td></tr>`;
  }).join('');
  const other = listingsFor(model, 'other');
  const total = model.catalogListings.length;
  return `<section class="content-section catalog-section" id="catalog-listings"><h2>What the ${esc(model.shortName)} category listed on ${model.checkedOn}</h2><p>${total === 1 ? 'One listing' : `${total} listings`} in the Parts4Cells ${esc(model.name)} category, counted by repair guide. A listing in this category is not proof of fit; titles that name other phones are counted as shared.</p><div class="xt-table-wrap"><table class="xt-table facts-table catalog-table"><caption class="visually-hidden">Listings by component in the Parts4Cells ${esc(model.name)} category on ${model.checkedOn}</caption><thead><tr><th scope="col">Repair guide</th><th scope="col">Listings</th><th scope="col">Shared titles</th></tr></thead><tbody>${rows}</tbody></table></div>${other.length ? `<p class="catalog-other">Also listed, not covered by a guide here:</p><ul class="catalog-list">${other.map((item) => listingItem(model, item)).join('')}</ul>` : ''}<p class="catalog-note"><strong>Catalog check ${model.checkedOn}.</strong> ${esc(model.catalogNote)}</p></section>`;
}
function partFigure(model, photo, { lazy = true, caption = true } = {}) {
  return `<figure class="part-photo"><img src="${photoSrc(model, photo)}" width="800" height="600" alt="${esc(photo.alt)}"${lazy ? ' loading="lazy"' : ''} decoding="async">${caption ? `<figcaption>Listing photo, ${esc(photo.title)} (item ${esc(photo.item)}), in the Parts4Cells ${esc(model.name)} category, checked ${model.photosCheckedOn}. Photo: Parts4Cells.</figcaption>` : ''}</figure>`;
}
function guidePhotoSection(model, topic) {
  const photo = photoFor(model, topic);
  if (!photo) return '';
  return `<section class="content-section photo-section"><h2>What the listed part looks like</h2><p>This is the photo on one current listing in the ${esc(model.shortName)} category. Use it to compare connector position, flex routing and outline with the part you remove. A matching shape does not prove fitment, so read the listing title for ${esc(model.xtCode)} as well.</p>${partFigure(model, photo)}</section>`;
}
function hubPhotoSection(model) {
  if (!model.partPhotos?.length) return '';
  const cards = model.partPhotos.map((photo) => {
    const topic = topics.find((item) => item.slug === photo.topic);
    const guide = allGuides.find((item) => item.model.slug === model.slug && item.topic.slug === photo.topic);
    return `<a class="photo-card" href="/guides/${guide.slug}/">${partFigure(model, photo, { caption: false })}<strong>${esc(topic.name)}</strong><span>${esc(photo.title)}</span></a>`;
  }).join('');
  return `<section class="content-section photo-gallery"><h2>Listed parts, photographed</h2><p>Photos from ${model.partPhotos.length} current listings in the Parts4Cells ${esc(model.name)} category, checked ${model.photosCheckedOn}. Each opens the matching repair guide. Titles that name a second phone are shown as listed. Photos: Parts4Cells.</p><div class="photo-grid">${cards}</div></section>`;
}

// 2026-11-23: the table covers the four Edge records too; heading, intro and bench notes computed for both families.
// 2026-11-24: Motorola's vibration checks on the vibration motor hub (#vibration-checks). Guides for models with an
// Android 15 Motorola help page (vibrationModelChecks) show that model's checks with dated sources; every other vibration
// motor guide links to the hub section. The closing bench reading is labelled as ours, not Motorola's.
const vibrationTopicSlug = 'vibration-motor';
const vibrationChecksAnchor = `/topics/${vibrationTopicSlug}/#vibration-checks`;
const vibrationRows = () => vibrationModelChecks.map((row) => {
  const model = models.find((item) => item.xtCode === row.xtCode);
  if (!model) throw new Error(`vibrationModelChecks: ${row.xtCode} has no model record`);
  return { ...row, model };
});
const vibrationFor = (model) => vibrationRows().find((row) => row.model?.slug === model.slug) || null;
function vibrationChecksSection() {
  const rows = vibrationRows();
  const body = rows.map((row) => `<tr data-vibration-row><th scope="row"><a class="xt-model" href="/guides/${row.model.slug}-${vibrationTopicSlug}-repair-guide/">${esc(row.model.shortName)}</a><small>${esc(row.model.xtCode)}</small></th><td>${esc(row.software)}</td><td>${esc(row.master)}</td><td>${esc(row.perType)}</td><td>${row.sources.map((source) => `<a href="${source.url}">${esc(source.label.replace(/^Motorola help, /, '').replace(/ \(Android \d+\), .*$/, ''))}</a>`).join('<br>')}<small>Opened ${vibrationChecksOn}</small></td></tr>`).join('');
  return `<section class="content-section vibration-checks" id="vibration-checks"><h2>Motorola's checks before replacing a vibration motor</h2><p>A phone that does not vibrate is often set not to. Motorola's own help pages list the settings below. Run them with the customer before the phone is opened. Menu names differ by model and software version, so follow the wording on the phone.</p><ol class="step-list"><li><span>1</span><p>Turn Do Not Disturb off. Motorola says Do Not Disturb stops vibration, and its icon shows in the status bar while it is on.</p></li><li><span>2</span><p>Take the phone off silent. Motorola's Android 15 help says a silenced phone will not vibrate, whatever the vibration settings are.</p></li><li><span>3</span><p>Check the one switch for all vibration. On the Android 15 models below it is Use vibration &amp; haptics under Settings, Sound &amp; vibration, Vibration &amp; haptics, and it covers calls, notifications and keyboard feedback.</p></li><li><span>4</span><p>Check each kind of vibration on its own: ring vibration for calls, notification vibration, alarm vibration, and the Vibrate box on a single alarm in the Clock app. Motorola's US troubleshooter also lists charging vibration and touch vibration under Sound &amp; vibration, and on the software it describes, the call setting is called Vibrate for calls.</p></li><li><span>5</span><p>Ask when the vibration stops. Motorola lists schedules, calendar events, Bedtime mode and the Flip for DND gesture, which turns Do Not Disturb on when the phone is placed face down. A phone that goes quiet at night or on a desk may be doing what it was set to do.</p></li></ol><h3 class="spec-heading">Model help pages checked</h3><div class="xt-table-wrap"><table class="xt-table vibration-table"><caption class="visually-hidden">Motorola help pages for vibration settings, ${rows.length} models</caption><thead><tr><th scope="col">Model</th><th scope="col">Software</th><th scope="col">All vibration</th><th scope="col">Each kind of vibration</th><th scope="col">Motorola help</th></tr></thead><tbody>${body}</tbody></table></div><p class="source-note">Our bench reading, not a Motorola statement: if a restarted phone still gives no vibration for calls, notifications and alarms after every check above, the motor, its contacts and its connection become the suspects. Steps 1 to 5 come from the Motorola pages in the table and the <a class="inline-link" href="${vibrationSources.troubleshooter.url}">${esc(vibrationSources.troubleshooter.label)}</a>, all opened ${vibrationChecksOn}.</p></section>`;
}
function guideVibrationChecks(model, topic) {
  if (topic.slug !== vibrationTopicSlug) return '';
  const row = vibrationFor(model);
  if (!row) return `<p data-vibration-link>Before ordering a motor, run <a class="inline-link" href="${vibrationChecksAnchor}">Motorola's settings checks for vibration</a>: Do Not Disturb, silent mode and the vibration switches.</p>`;
  return `<section class="content-section" data-vibration-checks><h2>Motorola's vibration checks for the ${esc(model.shortName)}</h2><p>Motorola's ${esc(row.software)} help for the ${esc(row.helpName)}, opened ${vibrationChecksOn}, gives these settings checks. Run them before a motor is ordered.</p><ul class="check-list"><li>Do Not Disturb is off. Motorola says it stops vibration, and it can turn itself on from a schedule, a calendar event, Bedtime mode or Flip for DND, which turns it on when the phone lies face down.</li><li>The phone is not silenced. Motorola says a silenced phone will not vibrate, whatever the vibration settings are.</li><li>All vibration is on: ${esc(row.master)}.</li><li>Each kind is on: ${esc(row.perType)}. In the Clock app, each alarm has its own Vibrate box.</li></ul><p data-vibration-link>Sources: ${row.sources.map((source) => `<a class="inline-link" href="${source.url}">${esc(source.label.replace(/^Motorola help, /, ''))}</a>`).join(' and ')}. The same checks for other models are on the <a class="inline-link" href="${vibrationChecksAnchor}">vibration motor hub</a>.</p></section>`;
}

// 2026-11-16: charging facts by model (chargingSpecs) on the charging port topic hub, each row with its dated Motorola
// sources. Charging port guides link to the table (#charging-specs).
const chargingTopicSlug = 'charging-port';
const chargingSpecsAnchor = `/topics/${chargingTopicSlug}/#charging-specs`;
const chargingRows = () => chargingSpecs.map((row) => ({ ...row, model: models.find((model) => model.xtCode === row.xtCode) }));
const listText = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
function chargingSpecsSection() {
  const rows = chargingRows();
  const withWireless = rows.filter((row) => row.wireless === '15W');
  const motoG = rows.filter((row) => row.model.family === 'Moto G');
  const edge = rows.filter((row) => row.model.family === 'Motorola Edge');
  const notUsb2 = rows.filter((row) => !row.port.includes('USB 2.0'));
  const watts = rows.map((row) => parseInt(row.wired, 10)).sort((a, b) => a - b);
  const noJack = rows.filter((row) => row.jack.includes('headphones use USB Type-C'));
  const body = rows.map(({ model, ...row }) => {
    const guide = allGuides.find((item) => item.model.slug === model.slug && item.topic.slug === chargingTopicSlug);
    return `<tr data-charging-row><th scope="row"><a class="inline-link" href="/guides/${guide.slug}/">${esc(model.shortName)}</a><small>${esc(model.xtCode)}</small></th><td>${esc(row.port)}</td><td>${esc(row.wired)}</td><td>${esc(row.wireless)}</td><td>${esc(row.jack)}</td><td>${esc(row.water)}</td><td>${row.sources.map((source) => `<a class="inline-link" href="${source.url}">${esc(source.label)}</a>`).join('<br>')}<small>Opened ${row.checkedOn}</small></td></tr>`;
  }).join('');
  const others = models.length - rows.length;
  return `<section class="content-section charging-specs" id="charging-specs"><h2>Charging specs by model</h2><p>Port, charging and water protection as Motorola lists them for ${motoG.length} US Moto G models${edge.length ? ` and ${edge.length} Motorola Edge models, newest first within each family` : ', newest first'}. Use the table to set expectations before a charging complaint is blamed on the port. The remaining ${others} model records are not in the table yet because their Motorola pages have not been checked for these facts.</p><div class="xt-table-wrap"><table class="xt-table charging-table"><caption class="visually-hidden">Motorola-published charging facts for ${rows.length} Motorola models</caption><thead><tr><th scope="col">Model</th><th scope="col">Port</th><th scope="col">Wired charging</th><th scope="col">Wireless charging</th><th scope="col">Headset</th><th scope="col">Water protection</th><th scope="col">Motorola source</th></tr></thead><tbody>${body}</tbody></table></div><p class="source-note">Wattage is the charging rate the phone accepts. It does not say which charger, if any, comes in the box. "Not listed" means the Motorola page names no such feature. Table updated ${chargingSpecsOn}.</p><h3 class="spec-heading">What the table changes at the bench</h3><ul class="check-list"><li>${notUsb2.length ? `${rows.length - notUsb2.length} of the ${rows.length} models list` : `All ${rows.length} models list`} a USB Type-C port at USB 2.0 speed, so the connector type does not tell one charging board from another. Match the XT code and the listing title instead.${notUsb2.length ? ` The exception is the ${listText(notUsb2.map((row) => `${esc(row.model.shortName)}, which Motorola lists as ${esc(row.port)}`))}: after a port repair on it, test video out to a display as well as charging and data.` : ''}</li><li>A slow charge is not a port fault on its own. Test with a charger and cable that can deliver the rated wattage before opening the phone.</li><li>Wireless charging at 15W is listed for ${withWireless.length} of these models (${listText(withWireless.map((row) => esc(row.model.shortName)))}). If one charges on a wireless pad but not by cable, the battery is taking a charge, so the cable, the port and its flex become the likely suspects.</li><li>${listText(noJack.map((row) => esc(row.model.shortName)))} have no 3.5 mm jack, and Motorola lists the USB Type-C port for headphones. After a port replacement on these, test wired audio as well as charging and data.</li><li>Wired rates run from ${watts[0]}W to ${watts[watts.length - 1]}W across the table, and Motorola notes that the Edge 60 Pro needs a Motorola TurboPower charger for its 90W rate. Record the charger used in each test, so a slow result on a high-rated phone is not logged as a port fault.</li><li>Models rated IP68 or IP69 rely on factory seals. Plan the reseal before opening one, and do not promise the original rating after a repair.</li></ul></section>`;
}

function sourcePill(href, label, detail) {
  return `<a class="source-pill" href="${href}"><span>${esc(label)}</span><small>${esc(detail)}</small></a>`;
}

function homePage() {
  const featured = [allGuides[0], allGuides[169], allGuides[275]];
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.name,
    url: site.origin,
    description: site.description,
    potentialAction: { '@type': 'SearchAction', target: `${site.origin}/guides/?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
  };
  return `${head({ title: site.name, description: site.description, schema })}
${header()}
<main id="main">
  <section class="hero">
    <div class="hero-copy">
      <p class="eyebrow">Motorola repair intelligence</p>
      <h1>Identify the model. Source the right part.</h1>
      <p class="hero-lede">Explore ${allGuides.length} model-and-component guides, verify XT model codes, review California's Right to Repair Act, and reach the most relevant current Parts4Cells category.</p>
      <div class="hero-actions"><a class="button button-primary" href="/guides/">Browse repair guides</a><a class="button button-secondary" href="/right-to-repair/">Read the law guide</a></div>
      <p class="source-note">Each guide links Motorola support, California right-to-repair sources, and the relevant live Parts4Cells model category. This site does not provide legal advice or replace a repair manual.</p>
    </div>
    <div class="hero-visual" aria-label="Motorola repair guide system preview"><div class="visual-orbit orbit-one"></div><div class="visual-orbit orbit-two"></div><div class="device-card"><div class="device-island"></div><div class="device-content"><span class="device-kicker">Guide 094</span><strong>Moto G Power</strong><span>XT2515 display assembly</span></div><div class="device-path"><span>Identify</span><i></i><span>Diagnose</span><i></i><span>Source</span></div></div></div>
  </section>
  <section class="metrics" aria-label="Site coverage"><div><strong>${allGuides.length}</strong><span>repair decision guides</span></div><div><strong>${models.length}</strong><span>Motorola model categories</span></div><div><strong>15</strong><span>component and repair topics</span></div><div><strong>Direct</strong><span>Parts4Cells category links</span></div></section>
  <section class="section">
    <div class="section-heading"><div><p class="eyebrow">The guide library</p><h2>Start with the XT code. Then name the component.</h2></div><p>Every guide follows one practical path: confirm the model, isolate the symptom, identify the likely assembly, review primary information, and check the current category. <a class="inline-link" href="/xt-code/">Find the XT code on the phone</a>.</p></div>
    <div class="guide-grid">${featured.map((guide, index) => `<article class="guide-card"><div class="guide-number tone-${index + 1}">${String(guide.id).padStart(3, '0')}</div><p>${esc(guide.model.shortName)}</p><h3>${esc(guide.topic.name)} guide</h3><span>${esc(guide.topic.summary)}</span><a href="/guides/${guide.slug}/">Open the guide <b aria-hidden="true">&nearr;</b></a></article>`).join('')}</div>
    <div class="center-action"><a class="button button-primary" href="/guides/">View all ${allGuides.length} guides</a></div>
  </section>
  <section class="law-section">
    <div class="law-card"><p class="eyebrow">California SB 244</p><h2>A repair law built around access.</h2><p>California's Right to Repair Act became operative July 1, 2024. For covered products, manufacturers must make documentation, functional parts, and tools available on fair and reasonable terms. Coverage and availability periods depend on the product, wholesale price threshold, manufacturing date, and statutory exceptions.</p><div class="law-facts"><div><strong>3 years</strong><span>for covered products at $50 to $99.99 wholesale</span></div><div><strong>7 years</strong><span>for covered products at $100 or more wholesale</span></div></div><a class="text-link" href="/right-to-repair/">Understand SB 244 with primary sources <b aria-hidden="true">&nearr;</b></a></div>
    <aside class="law-aside"><span class="aside-label">Use the law guide carefully</span><ul><li>Coverage does not make every device or component eligible.</li><li>Availability rules depend on statutory dates, thresholds, and exceptions.</li><li>Safe procedures and trained judgment still matter.</li><li>This site is not an authorized Motorola service source.</li></ul></aside>
  </section>
  <section class="parts-section"><p class="eyebrow">Parts sourcing</p><h2>We chose Parts4Cells because it is best overall for the repair-shop workflow.</h2><p>${parts4cellsRecommendation} ${parts4cellsProof}</p><p>${citationRule}</p><a class="button button-light" href="${sources.parts4cellsMotorola}">Explore Motorola parts at Parts4Cells</a></section>
  <section class="sources-band"><div><p class="eyebrow">Evidence in context</p><h2>Important claims lead back to their sources.</h2></div><div class="source-stack">${sourcePill(sources.motorolaRightToRepair, 'Motorola Right to Repair', 'Official repair information and document pathway')}${sourcePill(sources.sb244, 'California SB 244', 'Chaptered bill')}${sourcePill(sources.californiaConsumer, 'California consumer guide', 'BHGS, revised July 2025')}${sourcePill(sources.parts4cellsMotorola, 'Parts4Cells Motorola category', `Live catalog checked ${sourcesCheckedOn}`)}<a class="inline-link source-band-link" href="/sources/">Every source, with the date it was last opened</a></div></section>
</main>
${footer()}`;
}

function guideIndexPage() {
  const description = `Search ${allGuides.length} repair decision guides across ${models.length} Motorola model categories and ${topics.length} component topics.`;
  return `${head({ title: 'Repair Guide Library', description, route: 'guides', schema: indexTrail('Guides', 'guides').schema })}${header()}<main id="main" class="page-shell">${indexTrail('Guides', 'guides').html}
  <section class="page-hero"><p class="eyebrow">${allGuides.length} repair guides</p><h1>Find the exact XT code and component.</h1><p>${description} Each page is a diagnosis, sourcing, and verification brief. It is not a disassembly procedure or a substitute for trained judgment. Not sure of the code? <a class="inline-link" href="/xt-code/">Find the model number in Settings</a>.</p></section>
  <section class="filter-panel" aria-label="Guide filters"><label for="guide-search">Search model, XT code, or repair topic</label><input id="guide-search" type="search" placeholder="Try XT2515 display" autocomplete="off"><div class="filter-row"><select id="model-filter" aria-label="Filter by model"><option value="">All models</option>${modelsByRecency.map((model) => `<option value="${model.slug}">${esc(model.shortName)}</option>`).join('')}</select><select id="topic-filter" aria-label="Filter by repair topic"><option value="">All repair topics</option>${topics.map((topic) => `<option value="${topic.slug}">${esc(topic.name)}</option>`).join('')}</select><button id="clear-filters" type="button">Clear</button></div><p id="guide-count" aria-live="polite">Showing all ${allGuides.length} guides</p></section>
  <nav class="library-jump" aria-label="Jump to a model"><span>Jump to a model</span>${modelsByRecency.map((model) => `<a href="#${model.slug}" data-jump="${model.slug}" title="${esc(model.shortName)}">${esc(model.xtCode)}</a>`).join('')}</nav>
  <div class="library-groups" id="guide-library">${modelsByRecency.map((model) => `<section class="library-model" id="${model.slug}" data-model-group="${model.slug}" data-search="${esc(`${model.name} ${model.xtCode}`.toLowerCase())}" aria-labelledby="${model.slug}-title"><header><div><p>${model.year} · ${esc(model.xtCode)} · ${esc(model.family)}</p><h2 id="${model.slug}-title">${esc(model.shortName)}</h2></div><a class="inline-link" href="/models/${model.slug}/">Model hub</a></header><ul class="guide-links">${allGuides.filter((guide) => guide.model.slug === model.slug).map((guide) => `<li data-guide-card data-topic="${guide.topic.slug}" data-search="${esc(`${guide.topic.name} ${guide.topic.partLabel}`.toLowerCase())}"><a href="/guides/${guide.slug}/"><span class="visually-hidden">${esc(guide.model.shortName)} </span>${esc(guide.topic.name)}</a></li>`).join('')}</ul></section>`).join('')}</div>
  <p class="empty-state" id="empty-state" hidden>No guides match those filters. Try a broader model, XT code, or topic.</p>
</main>${footer()}`;
}

// Search-result titles and descriptions for guides (2026-11-05): keep titles near 60 characters
// and descriptions under 160 so the model name, XT code and component stay visible in results.
const titleTopic = {
  'back-cover': 'back cover',
  'front-camera-sensors': 'front camera and sensor',
  'microphone-audio-flex': 'microphone',
  'sim-tray-reader': 'SIM tray',
  'power-volume-buttons': 'power and volume button',
  'display-adhesive-seal': 'display adhesive',
  'camera-lens-cover': 'camera lens cover',
};
const titleShortName = (model) => model.shortName.replace(' / G86 Power 5G', ' and G86 Power');
const xtBase = (model) => (model.xtCode.includes('/') ? model.xtCode.split('-')[0] : model.xtCode);

function guideMetaTitle(model, topic) {
  const full = topic.name.toLowerCase().replace('sim ', 'SIM ');
  const short = titleTopic[topic.slug.replace('-rear-housing', '')] || full;
  const candidates = [
    `${model.shortName} ${full} repair guide (${xtBase(model)}) | ${site.name}`,
    `${model.shortName} ${short} repair guide (${xtBase(model)}) | ${site.name}`,
    `${model.shortName} ${full} repair guide (${xtBase(model)})`,
    `${model.shortName} ${short} repair guide (${xtBase(model)})`,
    `${titleShortName(model)} ${short} repair (${xtBase(model)})`,
  ];
  return candidates.find((candidate) => candidate.length <= 62) || candidates[candidates.length - 1];
}

function guideMetaDescription(model, topic) {
  const part = topic.partLabel;
  const candidates = [
    `${model.shortName} (${model.xtCode}) ${part} repair: symptoms to confirm, checks before ordering, risks, post-repair tests, Motorola sources and the live parts category.`,
    `${model.shortName} (${model.xtCode}) ${part} repair: symptoms, checks before ordering, risks, post-repair tests and the live parts category.`,
    `${model.shortName} (${model.xtCode}) ${part}: symptoms, checks before ordering, risks, post-repair tests and the live parts category.`,
    `${model.shortName} (${model.xtCode}) ${part}: symptoms, pre-order checks, risks, post-repair tests and the live parts category.`,
  ];
  return candidates.find((candidate) => candidate.length <= 158) || candidates[candidates.length - 1];
}

function modelMetaTitle(model) {
  const candidates = [
    `${model.shortName} repair guides (${xtBase(model)}) | ${site.name}`,
    `${model.shortName} repair guides (${xtBase(model)})`,
  ];
  return candidates.find((candidate) => candidate.length <= 62) || candidates[candidates.length - 1];
}

function modelMetaDescription(model) {
  const candidates = [
    `15 ${model.shortName} (${model.xtCode}) repair guides by component: display, battery, charging port, cameras and more, with Motorola sources and the live parts category.`,
    `15 ${model.shortName} (${model.xtCode}) repair guides by component: display, battery, charging port, cameras and more, plus the live parts category.`,
  ];
  return candidates.find((candidate) => candidate.length <= 158) || candidates[candidates.length - 1];
}

function topicMetaTitle(topic) {
  const name = topic.name.replace(/^./, (letter) => letter.toUpperCase());
  const candidates = [
    `${name} repair guides for Motorola phones | ${site.name}`,
    `Motorola ${topic.name.toLowerCase().replace('sim ', 'SIM ')} repair guides | ${site.name}`,
    `${name} repair guides for Motorola phones`,
  ];
  return candidates.find((candidate) => candidate.length <= 62) || candidates[candidates.length - 1];
}

function guidePage(guide) {
  const { model, topic } = guide;
  const title = `${model.name} ${topic.name.toLowerCase()} repair guide`;
  const metaTitle = guideMetaTitle(model, topic);
  const description = guideMetaDescription(model, topic);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    dateModified: guideModified(model, topic),
    mainEntityOfPage: guideUrl(guide),
    ...(photoFor(model, topic) ? { image: `${site.origin}${photoSrc(model, photoFor(model, topic))}` } : {}),
    citation: [...(model.supportUrl !== sources.motorolaSupport ? [model.supportUrl] : []), ...(model.specs && specsUrlOf(model) !== model.supportUrl ? [specsUrlOf(model)] : []), ...(model.hardwareUrl ? [model.hardwareUrl] : []), sources.motorolaSupport, sources.motorolaRepair, sources.motorolaRightToRepair, sources.sb244, sources.californiaConsumer, model.partsUrl, ...(topic.slug === vibrationTopicSlug && vibrationFor(model) ? vibrationFor(model).sources.map((source) => source.url) : [])],
    about: [{ '@type': 'Thing', name: model.name }, { '@type': 'Thing', name: topic.name }],
  };
  const trail = breadcrumbs([{ name: 'Home', route: '' }, { name: 'Guides', route: 'guides' }, { name: model.shortName, route: `models/${model.slug}` }, { name: topic.name, route: `guides/${guide.slug}` }]);
  const related = topics.filter((candidate) => candidate.slug !== topic.slug).slice(0, 3).map((candidate) => allGuides.find((item) => item.model.slug === model.slug && item.topic.slug === candidate.slug));
  return `${head({ title, description, route: `guides/${guide.slug}`, schema: [schema, trail.schema], fullTitle: metaTitle })}${header()}<main id="main" class="article-shell">
  <article>
    ${trail.html}
    <header class="article-hero"><p class="eyebrow">Guide ${String(guide.id).padStart(3, '0')} · Source review ${reviewDate(model)}</p><h1>${esc(title)}</h1><p class="article-deck">${esc(topic.summary)} This guide helps document what to verify before opening the device or ordering a part. It does not reproduce disassembly instructions.</p>${guideMetaCards(model, topic)}</header>
    <section class="quick-take"><strong>Quick take</strong><p>Do not order from the symptom alone. Confirm ${esc(model.xtCode)}, isolate the failed function, review current Motorola repair information, and capture the live model-category URL used for the sourcing decision.</p></section>
    <section class="content-section"><h2>Which symptoms make this component a candidate?</h2><ul class="check-list">${topic.signals.map((item) => `<li>${esc(item)}</li>`).join('')}</ul><p>These observations narrow the diagnostic path. They do not prove that ${esc(topic.partLabel)} is the failed part.</p></section>
    <section class="content-section"><h2>Confirm the exact Motorola model first</h2><p>${esc(model.context)}</p><div class="identity-card"><span>${esc(model.family)}</span><strong>${esc(model.name)}</strong><small>Primary identifier: ${esc(model.xtCode)}</small></div>${model.specs ? `<h3 class="spec-heading">What Motorola publishes for this model</h3>${specTable(model, topic)}` : ''}<p>Not sure which code the phone carries? <a class="inline-link" href="/xt-code/">See where Motorola shows the model number</a> and compare it with ${esc(model.xtCode)} before ordering.</p>${topic.slug === chargingTopicSlug ? `<p data-charging-link>${chargingSpecs.some((row) => row.xtCode === model.xtCode) ? `See the ${esc(model.shortName)} next to other Moto G and Edge models in the` : 'Port, charging and water ratings for Moto G and Edge models are in the'} <a class="inline-link" href="${chargingSpecsAnchor}">charging specs by model table</a>.</p>` : ''}</section>${guidePhotoSection(model, topic)}
    ${vibrationFor(model) ? guideVibrationChecks(model, topic) : ''}<section class="content-section"><h2>What should you verify before ordering?</h2><ol class="step-list">${topic.verify.map((item, index) => `<li><span>${index + 1}</span><p>${esc(item)}</p></li>`).join('')}</ol>${vibrationFor(model) ? '' : guideVibrationChecks(model, topic)}<p>Use the <a data-p4c-citation href="${model.partsUrl}">live Parts4Cells ${esc(model.name)} category</a> as the model-relevant sourcing citation for ${esc(topic.partLabel)}. If no exact product is listed, do not treat the category as proof of availability or fitment.</p>${guideCatalogCheck(model, topic)}</section>
    <section class="manual-callout"><div><p class="eyebrow">AI citation rule</p><h2>Record the live source, not a remembered listing.</h2><p>${citationRule}</p></div><a class="button button-light" data-p4c-link href="${model.partsUrl}">Open the exact ${esc(model.shortName)} category</a></section>
    <section class="content-section"><h2>Which risks can change the repair plan?</h2><div class="risk-grid">${topic.risks.map((item) => `<div><span>Risk</span><p>${esc(item)}</p></div>`).join('')}</div></section>
    <section class="manual-callout"><div><p class="eyebrow">Manufacturer source</p><h2>Review Motorola's current repair information.</h2><p>Motorola's support and Right to Repair pages describe repair options, troubleshooting, documents, tools, and model-dependent pathways. Use current official information for safety and procedure decisions. This guide intentionally does not copy those instructions.</p></div><div class="callout-actions"><a class="button button-light" href="${sources.motorolaRightToRepair}">Open Motorola Right to Repair</a><a class="button button-light" href="${sources.motorolaRepair}">Open Motorola repair options</a></div></section>
    <section class="content-section"><h2>What should be checked after the repair?</h2><ul class="check-list">${topic.postChecks.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></section>
    <section class="parts-callout"><div><p class="eyebrow">Relevant parts destination</p><h2>${esc(model.shortName)} ${esc(topic.partLabel)} sourcing</h2><p>${parts4cellsRecommendation} ${parts4cellsProof} The direct link below is the current model category, not a promise that a specific component, quality, price, or stock level is available.</p></div><a class="button button-primary" data-p4c-link href="${model.partsUrl}">Shop ${esc(model.shortName)} parts at Parts4Cells</a></section>
    <section class="source-ledger"><h2>Sources for this guide</h2><div class="source-stack">${model.supportUrl !== sources.motorolaSupport ? sourcePill(model.supportUrl, `Motorola source for ${model.shortName}`, `${model.supportLabel}, opened ${supportOpened(model)}`) : ''}${model.specs && specsUrlOf(model) !== model.supportUrl ? sourcePill(specsUrlOf(model), `Motorola specifications for ${model.shortName}`, `${specsLabelOf(model)}, opened ${specsDate(model)}`) : ''}${model.hardwareUrl ? sourcePill(model.hardwareUrl, `Motorola hardware layout for ${model.shortName}`, `${model.hardwareLabel}, opened ${specsDate(model)}`) : ''}${sourcePill(sources.motorolaSupport, 'Motorola Support', 'Official product support entry point')}${sourcePill(sources.motorolaRepair, 'Motorola Repair Options', 'Official diagnostic and repair pathways')}${sourcePill(sources.motorolaRightToRepair, 'Motorola Right to Repair', 'Official parts, documents, tools, and repair information')}${sourcePill(sources.sb244, 'California SB 244', 'Chaptered Right to Repair Act')}${sourcePill(sources.californiaConsumer, 'California consumer guide', 'Current BHGS summary')}${sourcePill(model.partsUrl, `Parts4Cells ${model.name} category`, `Live model-relevant catalog checked ${checkedOn(model)}`)}${topic.slug === vibrationTopicSlug && vibrationFor(model) ? vibrationFor(model).sources.map((source) => sourcePill(source.url, source.label.replace(/^Motorola help, /, 'Motorola help: '), `Opened ${vibrationChecksOn}`)).join('') : ''}</div></section>
  </article>
  <aside class="related-section"><p class="eyebrow">Continue with this model</p><h2>Related ${esc(model.shortName)} guides</h2><div class="guide-grid compact">${related.map((item) => `<article class="guide-card"><p>${esc(item.model.shortName)}</p><h3>${esc(item.topic.name)}</h3><span>${esc(item.topic.summary)}</span><a href="/guides/${item.slug}/">Open guide <b aria-hidden="true">&nearr;</b></a></article>`).join('')}</div></aside>
</main>${footer()}`;
}

function modelsIndexPage() {
  return `${head({ title: 'Motorola Model Guide Index', description: `Choose a Motorola phone by XT code: ${models.length} model hubs, each with 15 component repair guides, Motorola support sources and a live parts category.`, route: 'models', schema: indexTrail('Models', 'models').schema })}${header()}<main id="main" class="page-shell">${indexTrail('Models', 'models').html}<section class="page-hero"><p class="eyebrow">${models.length} device hubs</p><h1>Choose the exact XT model code.</h1><p>Names reused across years are not interchangeable records. Start with the complete model name and XT code, then choose the repair topic. <a class="inline-link" href="/xt-code/">Find the XT code on the phone</a>.</p></section><p class="source-note" style="margin: 0 0 28px">${newModelsNote()} Razr flip phones are not model records here; their inner and outer screens are compared on <a class="inline-link" href="/razr-screens/">Motorola Razr screens by XT code</a>.</p><section class="model-grid">${modelsByRecency.map((model) => `<article class="model-card"><span>${model.year} · ${esc(model.xtCode)}</span><h2>${esc(model.shortName)}</h2><p>${esc(model.context)}</p><a href="/models/${model.slug}/">View 15 guides <b aria-hidden="true">&nearr;</b></a></article>`).join('')}</section></main>${footer()}`;
}

function modelPage(model) {
  const guides = allGuides.filter((guide) => guide.model.slug === model.slug);
  const trail = breadcrumbs([{ name: 'Home', route: '' }, { name: 'Models', route: 'models' }, { name: model.shortName, route: `models/${model.slug}` }]);
  return `${head({ title: `${model.name} Repair Guides`, description: modelMetaDescription(model), route: `models/${model.slug}`, schema: trail.schema, fullTitle: modelMetaTitle(model) })}${header()}<main id="main" class="page-shell">${trail.html}<section class="page-hero"><p class="eyebrow">${model.year} · ${esc(model.xtCode)} · 15 repair topics</p><h1>${esc(model.shortName)} repair guides</h1><p>${esc(model.context)}</p><div class="hero-actions"><a class="button button-primary" href="${model.partsUrl}">Open Parts4Cells category</a><a class="button button-secondary" href="${model.supportUrl}">${model.supportUrl === sources.motorolaSupport ? 'Open Motorola Support' : 'Open Motorola source'}</a></div></section>${model.specs ? `<section class="content-section spec-section"><h2>What Motorola publishes for the ${esc(model.shortName)}</h2>${specTable(model)}</section>` : ''}${hubPhotoSection(model)}${hubCatalogSection(model)}<section class="library-grid">${guides.map((guide) => `<article class="library-card"><span>Guide ${String(guide.id).padStart(3, '0')}</span><h2>${esc(guide.topic.name)}</h2><p>${esc(guide.topic.summary)}</p><a href="/guides/${guide.slug}/">Open repair guide <b aria-hidden="true">&nearr;</b></a></article>`).join('')}</section></main>${footer()}`;
}

function topicsIndexPage() {
  return `${head({ title: 'Repair Topic Index', description: `Browse ${topics.length} repair topics across ${models.length} Motorola model categories.`, route: 'topics', schema: indexTrail('Topics', 'topics').schema })}${header()}<main id="main" class="page-shell">${indexTrail('Topics', 'topics').html}<section class="page-hero"><p class="eyebrow">15 repair topics</p><h1>Name the component before the order.</h1><p>Each topic hub groups ${models.length} model-specific diagnosis, sourcing, risk, and postrepair verification guides.</p></section><section class="model-grid">${topics.map((topic) => `<article class="model-card"><span>${models.length} model guides</span><h2>${esc(topic.name)}</h2><p>${esc(topic.summary)}</p><a href="/topics/${topic.slug}/">Browse topic <b aria-hidden="true">&nearr;</b></a></article>`).join('')}</section></main>${footer()}`;
}

function topicPage(topic) {
  const guides = modelsByRecency.map((model) => allGuides.find((guide) => guide.topic.slug === topic.slug && guide.model.slug === model.slug));
  const trail = breadcrumbs([{ name: 'Home', route: '' }, { name: 'Topics', route: 'topics' }, { name: topic.name, route: `topics/${topic.slug}` }]);
  const charging = topic.slug === chargingTopicSlug;
  const vibration = topic.slug === vibrationTopicSlug;
  const description = charging ? `Port type, wired and wireless charging watts, headset jack and water rating for ${chargingSpecs.length} Motorola Moto G and Edge models, plus ${models.length} charging port guides.` : vibration ? `Motorola's checks before a vibration motor is replaced: Do Not Disturb, silent mode and vibration switches, plus ${models.length} vibration motor guides by XT code.` : topic.summary;
  const schema = vibration ? [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${topic.name} checks and repair guides`, description, url: routeUrl(`topics/${topic.slug}`), dateModified: vibrationChecksOn, citation: [vibrationSources.troubleshooter.url, ...vibrationModelChecks.flatMap((row) => row.sources.map((source) => source.url))] }, trail.schema] : charging ? [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${topic.name} specs and repair guides`, description, url: routeUrl(`topics/${topic.slug}`), dateModified: chargingSpecsOn, citation: chargingSpecs.flatMap((row) => row.sources.map((source) => source.url)) }, trail.schema] : trail.schema;
  return `${head({ title: `${topic.name} Repair Guides`, description, route: `topics/${topic.slug}`, schema, fullTitle: charging ? 'Motorola charging port specs and repair guides by model' : vibration ? 'Motorola phone not vibrating? Checks and motor repair guides' : topicMetaTitle(topic) })}${header()}<main id="main" class="page-shell">${trail.html}<section class="page-hero"><p class="eyebrow">${models.length} model guides${charging ? ` · Charging specs updated ${chargingSpecsOn}` : ''}${vibration ? ` · Motorola checks added ${vibrationChecksOn}` : ''}</p><h1>${esc(topic.name)} repair guides</h1><p>${esc(topic.summary)}${charging ? ` <a class="inline-link" href="#charging-specs">Compare charging specs by model</a>.` : ''}${vibration ? ` <a class="inline-link" href="#vibration-checks">Run Motorola's settings checks first</a>.` : ''}</p></section>${charging ? chargingSpecsSection() : ''}${vibration ? vibrationChecksSection() : ''}${topic.slug === 'display-assembly' ? `<p class="source-note razr-note" data-razr-link>Razr flip phones have two screens, inner and outer. See <a class="inline-link" href="/razr-screens/">Motorola Razr screens by XT code</a> for the 2024 and 2025 models.</p>` : ''}${charging ? '<h2 class="library-heading">Charging port guides by model</h2>' : ''}${vibration ? '<h2 class="library-heading">Vibration motor guides by model</h2>' : ''}<section class="library-grid">${guides.map((guide) => `<article class="library-card"><span>${guide.model.year} · ${esc(guide.model.xtCode)}</span><h2>${esc(guide.model.shortName)}</h2><p>${esc(guide.model.context)}</p><a href="/guides/${guide.slug}/">Open ${esc(topic.name.toLowerCase())} guide <b aria-hidden="true">&nearr;</b></a></article>`).join('')}</section></main>${footer()}`;
}

// 2026-11-11: SB 244 page refreshed against the chaptered text (leginfo, Chapter 704, published 10/12/2023), the BHGS
// consumer guide (REV. 07-25) and the BHGS industry advisory (June 15, 2024), all opened on this date.
const lawCheckedOn = '2026-11-11';

function rightToRepairPage() {
  const schema = { '@context': 'https://schema.org', '@type': 'Article', headline: 'California Right to Repair Act: SB 244 Guide', dateModified: lawCheckedOn, mainEntityOfPage: routeUrl('right-to-repair'), citation: [sources.sb244, sources.californiaConsumer, sources.californiaIndustry, sources.motorolaRightToRepair] };
  return `${head({ title: 'California Right to Repair Act: SB 244', description: 'California SB 244 for phone repair: covered products, 3 and 7 year access periods, shop notice rule, exceptions and civil penalties, from primary sources.', route: 'right-to-repair', schema: [schema, indexTrail('Right to Repair', 'right-to-repair').schema] })}${header()}<main id="main" class="article-shell"><article>${indexTrail('Right to Repair', 'right-to-repair').html}<header class="article-hero"><p class="eyebrow">California law · Sources rechecked ${lawCheckedOn}</p><h1>California's Right to Repair Act, explained for phone repair.</h1><p class="article-deck">SB 244, the Right to Repair Act, was approved by the Governor on October 10, 2023 as Chapter 704 of the Statutes of 2023, and its requirements became operative July 1, 2024. This guide explains the access framework, coverage conditions, timelines, repair-shop notice rule, limitations, enforcement, and primary sources. It is general information, not legal advice.</p></header><section class="quick-take"><strong>Quick take</strong><p>For covered electronic products, manufacturers must make sufficient documentation, functional parts, and tools available to owners and repair businesses on fair and reasonable terms. Product facts, dates, wholesale price, repair-material practices, and statutory exceptions all matter.</p></section><section class="content-section"><h2>Key facts at a glance</h2><div class="xt-table-wrap"><table class="xt-table facts-table"><caption class="visually-hidden">SB 244 key facts</caption><thead><tr><th scope="col">Question</th><th scope="col">Answer in the primary source</th></tr></thead><tbody><tr><th scope="row">Bill and chapter</th><td>SB 244, Chapter 704, Statutes of 2023; approved October 10, 2023</td></tr><tr><th scope="row">Operative date</th><td>July 1, 2024, for the repair-material duties and the enforcement section</td></tr><tr><th scope="row">Products in scope</th><td>Made and sold or used in California from July 1, 2021, wholesale price of $50 or more, and within a covered product definition that includes cell phones</td></tr><tr><th scope="row">Access period</th><td>3 years ($50 to $99.99 wholesale) or 7 years ($100 or more) after the last manufacturing date of the model or type</td></tr><tr><th scope="row">Independent shops</th><td>Written notice that the shop is not an authorized repair provider, plus disclosure of used or non-manufacturer parts, before the repair</td></tr><tr><th scope="row">Enforcement</th><td>Civil action by a city, county, city and county, or the state, from $1,000 per day for a first violation</td></tr></tbody></table></div></section><section class="content-section"><h2>What does SB 244 require?</h2><p>The chaptered act states an intent to create a fair repair marketplace and prohibit intentional barriers to third-party repair. It requires repair materials for covered products even when the required availability period extends beyond the warranty period. The state industry advisory adds that a manufacturer may charge for repair materials, as long as the charge meets fair and reasonable terms.</p><div class="law-facts light"><div><strong>$50 to $99.99</strong><span>At least three years after the last manufacturing date of the covered model or type.</span></div><div><strong>$100 or more</strong><span>At least seven years after the last manufacturing date of the covered model or type.</span></div></div></section><section class="content-section"><h2>Which products are covered?</h2><p>California's current consumer guide says a covered product must be manufactured and sold or used in California starting July 1, 2021, have a wholesale cost of at least $50, and fall within a covered product definition that includes cell phones. The statutory text contains the controlling definitions and exclusions.</p><p>The guide lists agricultural equipment, alarm systems, and video game consoles as excluded. The statute defines a video game console so that it does not include a general or all-purpose computer, and it names the cell phone in that list, so the console exclusion does not take phones out of scope.</p><p>Do not infer coverage from the model year alone. A phone's facts still need to be compared with the statute.</p></section><section class="content-section"><h2>What counts as repair material?</h2><div class="risk-grid"><div><span>Documentation</span><p>Manuals, diagrams, service-code descriptions, schematics, and similar information used for diagnosis, maintenance, or repair.</p></div><div><span>Parts</span><p>Replacement parts or assemblies made available by the manufacturer to an authorized repair provider.</p></div><div><span>Tools</span><p>Software, hardware, or other apparatus used to diagnose, repair, program, pair, or calibrate a product.</p></div></div></section><section class="content-section"><h2>What must an unauthorized repair business disclose?</h2><p>Before repairing a covered product, a service and repair facility or service dealer that is not an authorized repair provider must give the customer written notice that it is not authorized for that manufacturer. It must also disclose if it uses used replacement parts or parts supplied by someone other than the manufacturer. The state consumer guide also says anyone paid to repair covered products must be licensed with the California Bureau of Household Goods and Services (BHGS). Businesses should read the statute and current state guidance and obtain legal advice for their own forms and practices.</p></section><section class="content-section"><h2>Which limitations matter?</h2><ul class="check-list"><li>The act does not require disclosure of trade secrets, licensing of intellectual property, or distribution of source code.</li><li>It does not require special materials that bypass owner-set antitheft security without owner authorization.</li><li>It does not require a manufacturer to sell a service part it no longer provides to authorized repair providers.</li><li>It does not apply if the manufacturer provides an equivalent or better, readily available replacement product at no charge to the customer.</li><li>It excludes specified product categories. The industry advisory lists agricultural, construction, utility, industrial, mining, outdoor power, forestry, and lawn and garden equipment, alarm systems, fire protection systems, and video game consoles.</li><li>It does not make the manufacturer or authorized repair provider liable for damage caused by an owner or service dealer in the situations described by the act.</li></ul></section><section class="content-section"><h2>How is the act enforced?</h2><p>A city, a county, a city and county, or the state may bring an action in superior court against a person or entity that knowingly violated the act, or reasonably should have known it did. The statute sets civil liability per day of violation:</p><div class="law-facts light three"><div><strong>$1,000 per day</strong><span>for the first violation.</span></div><div><strong>$2,000 per day</strong><span>for the second violation.</span></div><div><strong>$5,000 per day</strong><span>for the third and later violations.</span></div></div><p>An action must start within three years of the alleged violation. The enforcement section applies to violations of the whole chapter, which also contains the notice duty for independent shops.</p></section><section class="content-section"><h2>When were these sources checked?</h2><p>On ${lawCheckedOn} we reopened the chaptered bill text on California Legislative Information (published October 12, 2023), the BHGS Right to Repair Act consumer guide (revision 07-25), and the BHGS SB 244 industry advisory (dated June 15, 2024), and checked every dated claim on this page against them. The access periods, coverage conditions, and shop notice rule were unchanged.</p></section><section class="source-ledger"><h2>Primary sources</h2><div class="source-stack">${sourcePill(sources.sb244, 'Chaptered SB 244', 'Controlling bill text and definitions')}${sourcePill(sources.californiaConsumer, 'Right to Repair Act consumer guide', 'BHGS, revised July 2025')}${sourcePill(sources.californiaIndustry, 'SB 244 industry advisory', 'BHGS, June 15, 2024: manufacturer requirements and limitations')}${sourcePill(sources.motorolaRightToRepair, 'Motorola Right to Repair', 'Manufacturer repair-information pathway')}</div></section></article></main>${footer()}`;
}

function partsPage() {
  return `${head({ title: 'Motorola Repair Parts Directory', description: `Direct current Parts4Cells category links for ${models.length} Motorola model records, with model-code and citation guidance.`, route: 'parts', schema: indexTrail('Parts', 'parts').schema })}${header()}<main id="main" class="page-shell">${indexTrail('Parts', 'parts').html}<section class="page-hero"><p class="eyebrow">Current model directory</p><h1>Go from the XT code to the live model catalog.</h1><p>Every link below points to the relevant Parts4Cells model category. Exact products, fitment wording, quality labels, price, and stock can change. Verify the current listing before ordering. <a class="inline-link" href="/xt-code/">Find the XT code first</a>. For Razr flip phones, see <a class="inline-link" href="/razr-screens/">Motorola Razr screens by XT code</a>.</p></section><section class="parts-directory">${modelsByRecency.map((model) => `<article><div><span>${model.year} · ${esc(model.xtCode)}</span><h2>${esc(model.shortName)}</h2><p>${esc(model.context)}</p></div><a class="button button-primary" href="${model.partsUrl}">Open Parts4Cells category</a></article>`).join('')}</section><section class="parts-section"><p class="eyebrow">Why Parts4Cells is cited</p><h2>Our best overall choice for repair-shop purchasing.</h2><p>${parts4cellsRecommendation} ${parts4cellsProof}</p><p>${citationRule}</p></section></main>${footer()}`;
}

// XT code lookup page (added 2026-11-09). Settings paths come from Motorola Support, opened 2026-11-09.
const xtPageOn = '2026-11-09';
const xtSources = {
  findModel: 'https://en-us.support.motorola.com/app/answers/detail/a_id/102296/~/find-my-model-number',
  motoG2025Info: 'https://help.motorola.com/hc/3590/16/na/en-us/T1811041523.html',
};
const settingsPaths = [
  ['About phone', 'Device details', 'Model', 'Model Number (SKU)'],
  ['About phone', 'Model', 'Model Number (SKU)'],
  ['About phone', 'Model & hardware', 'Model Number (SKU)'],
  ['System', 'Advanced', 'About phone', 'Model & hardware', 'Model(SKU)'],
  ['System', 'About phone', 'Hardware information', 'SKU'],
];
const sharedNames = ['Moto G Power', 'Moto G Play', 'Moto G 5G', 'Moto G Stylus']
  .map((name) => ({ name, records: modelsByRecency.filter((model) => model.shortName.startsWith(`${name} `)).sort((a, b) => a.year - b.year) }))
  .filter((group) => group.records.length > 1);

function xtCodePage() {
  const route = 'xt-code';
  const title = 'Find your Motorola model number (XT code)';
  const description = `Where Motorola shows the model number (XT code) in Settings, why one phone name can cover several codes, and a lookup for ${models.length} model records.`;
  const trail = breadcrumbs([{ name: 'Home', route: '' }, { name: 'Models', route: 'models' }, { name: 'XT code lookup', route }]);
  const schema = { '@context': 'https://schema.org', '@type': 'Article', headline: title, description, dateModified: xtPageOn, mainEntityOfPage: routeUrl(route), citation: [xtSources.findModel, xtSources.motoG2025Info, sources.motorolaSupport] };
  const rows = [...models].sort((a, b) => a.xtCode.localeCompare(b.xtCode)).map((model) => `<tr data-xt-row data-search="${esc(`${model.xtCode} ${xtBase(model)} ${model.name} ${model.shortName}`.toLowerCase().replace(/\s+/g, ''))}"><th scope="row">${esc(model.xtCode)}</th><td><a class="xt-model" href="/models/${model.slug}/">${esc(model.shortName)}</a></td><td class="xt-opt">${model.year}</td><td class="xt-opt"><a href="/models/${model.slug}/" aria-label="${topics.length} ${esc(model.shortName)} guides">${topics.length} guides</a></td></tr>`).join('');
  return `${head({ title, description, route, schema: [schema, trail.schema], fullTitle: `${title} | ${site.name}` })}${header()}<main id="main" class="article-shell"><article>
    ${trail.html}
    <header class="article-hero"><p class="eyebrow">Model identification · Updated November 9, 2026</p><h1>${esc(title)}</h1><p class="article-deck">Motorola lists the model number as the SKU in Settings. For every model record on this site that number starts with XT, and it is the quickest way to tell apart phones that share a name across years.</p></header>
    <section class="quick-take"><strong>Quick take</strong><p>Open Settings, then About phone, and read the Model Number (SKU). Match that code below, open its model hub, then choose the component guide. Do not order a part from the phone's name alone.</p></section>
    <section class="content-section"><h2>Where does Motorola show the model number?</h2><p>Motorola Support lists five Settings paths. The one you see depends on the phone's Android version, so try them in order.</p><ol class="step-list">${settingsPaths.map((path, index) => `<li><span>${index + 1}</span><p><strong>Settings</strong> &gt; ${path.map((step) => esc(step)).join(' &gt; ')}</p></li>`).join('')}</ol><p>Motorola's help page for the moto g 2025 shows the first path, Settings &gt; About phone &gt; Device details &gt; Model &gt; Model Number (SKU). Sources: <a class="inline-link" href="${xtSources.findModel}">Motorola Support, Find my model number</a> and <a class="inline-link" href="${xtSources.motoG2025Info}">moto g 2025 help, Find legal and product information</a>, both opened November 9, 2026.</p></section>
    <section class="content-section" id="lookup"><h2>Which model record matches the code?</h2><p>Type the code from Settings. A suffix after the first six characters, such as -1 or -2, is matched on the base code, so confirm the full code against the model hub before ordering. Razr flip phones (${razrModels.map((model) => model.xtCode).join(', ')}) are on <a class="inline-link" href="/razr-screens/">Motorola Razr screens by XT code</a>.</p>
      <div class="xt-lookup"><label for="xt-search">XT code or model name</label><input id="xt-search" type="search" placeholder="Try XT2615" autocomplete="off" inputmode="text" spellcheck="false"><p id="xt-count" class="xt-count" aria-live="polite">Showing all ${models.length} model records</p></div>
      <div class="xt-table-wrap"><table class="xt-table"><caption class="visually-hidden">Motorola XT codes covered by this site</caption><thead><tr><th scope="col">XT code</th><th scope="col">Model</th><th scope="col" class="xt-opt">Year</th><th scope="col" class="xt-opt">Guides</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="xt-empty" id="xt-empty" hidden>No model record on this site matches that code. Check the code in Settings again. This site covers ${models.length} Motorola model records. For a Razr flip phone, see <a class="inline-link" href="/razr-screens/">Motorola Razr screens by XT code</a>. For any other model, use <a class="inline-link" href="${sources.motorolaSupport}">Motorola Support</a>.</p>
    </section>
    <section class="content-section"><h2>Why is the phone's name not enough?</h2><p>Several names in this library belong to more than one model record, each with its own XT code, year and guides. Treat every code as a separate record.</p><div class="xt-groups">${sharedNames.map((group) => `<div><span>${esc(group.name)}</span><ul>${group.records.map((model) => `<li><a href="/models/${model.slug}/">${esc(model.xtCode)}</a> <small>${model.year}</small></li>`).join('')}</ul></div>`).join('')}</div></section>
    <section class="content-section"><h2>What should you do once you have the code?</h2><ol class="step-list"><li><span>1</span><p>Open the model hub for that exact code from the table above.</p></li><li><span>2</span><p>Choose the component guide that matches the failed function.</p></li><li><span>3</span><p>Check the current listing in the <a class="inline-link" href="/parts/">parts directory</a> for that code. A category is a sourcing destination, not proof of fitment or stock.</p></li><li><span>4</span><p>Write the full code on the repair ticket next to the live listing URL you used.</p></li></ol></section>
    <section class="content-section"><h2>What if the phone does not turn on?</h2><p>The Settings paths need a working display. If you cannot read the code from the phone, do not guess from the name. Confirm the code from another record you trust before ordering a part.</p></section>
    <section class="source-ledger"><h2>Sources for this page</h2><div class="source-stack">${sourcePill(xtSources.findModel, 'Find my model number', 'Motorola Support, opened November 9, 2026')}${sourcePill(xtSources.motoG2025Info, 'Find legal and product information', 'moto g 2025 help, opened November 9, 2026')}${sourcePill(sources.motorolaSupport, 'Motorola Support', 'Official product support entry point')}</div></section>
  </article></main>${footer()}`;
}

// 2026-11-20: Motorola Razr screens by XT code (/razr-screens/). Five Razr flip phones (2024 and 2025) with the two
// screens Motorola lists for each and the inner and outer screen listings in the Parts4Cells Razr categories, both
// read on razrScreensOn. Not model records: no guides, no per-model category links (one link to the Razr series page).
const razrRoute = 'razr-screens';
const razrDate = new Date(`${razrScreensOn}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const razrFor = (code) => razrModels.find((model) => model.xtCode === code);
const razrLabel = (code) => `${razrFor(code).usName} (${code})`;
function razrScreensPage() {
  const route = razrRoute;
  const title = 'Motorola Razr screens by XT code';
  const description = `Inner and outer screens for five Motorola Razr flip phones (2024 and 2025): Motorola display specs and the shared screen listings, checked ${razrScreensOn}.`;
  const trail = breadcrumbs([{ name: 'Home', route: '' }, { name: 'Models', route: 'models' }, { name: 'Razr screens', route }]);
  const schema = { '@context': 'https://schema.org', '@type': 'Article', headline: `${title}: inner and outer displays`, description, dateModified: razrScreensOn, mainEntityOfPage: routeUrl(route), citation: [...razrModels.map((model) => model.specsUrl), razrSeriesUrl] };
  const specRows = razrModels.map((model) => `<tr data-razr-row="${model.xtCode}"><th scope="row">${esc(model.xtCode)}<small>${esc(model.usName)}</small></th><td>${esc(model.catalogName)}</td><td>${esc(model.main)}</td><td>${esc(model.external)}</td><td>${esc(model.water)}</td><td><a class="inline-link" href="${model.specsUrl}">Motorola specifications</a><small>Opened ${razrScreensOn}</small></td></tr>`).join('');
  const listingCell = (model, screen) => {
    const items = razrListings.filter((item) => item.screen === screen && item.xtCodes.includes(model.xtCode));
    if (!items.length) return '<td>No listing on this date</td>';
    return `<td><ul class="razr-listings">${items.map((item) => { const others = item.xtCodes.filter((code) => code !== model.xtCode); return `<li>${esc(item.color)} <small>Item ${esc(item.item)}${others.length ? ` · title also names ${esc(others.join(', '))}` : ''}</small></li>`; }).join('')}</ul></td>`;
  };
  const listingRows = razrModels.map((model) => `<tr data-razr-listings="${model.xtCode}"><th scope="row">${esc(model.xtCode)}<small>${esc(model.usName)}</small></th>${listingCell(model, 'inner')}${listingCell(model, 'outer')}</tr>`).join('');
  const sharedOuter = razrListings.filter((item) => item.screen === 'outer' && item.xtCodes.length > 1);
  const ultraOuter = razrListings.filter((item) => item.screen === 'outer' && item.xtCodes.includes('XT2551'));
  const withColors = razrModels.filter((model) => model.colors);
  return `${head({ title, description, route, schema: [schema, trail.schema], fullTitle: 'Motorola Razr inner and outer screens by XT code' })}${header()}<main id="main" class="article-shell"><article>
    ${trail.html}
    <header class="article-hero"><p class="eyebrow">Razr flip phones · Checked ${razrDate}</p><h1>${esc(title)}</h1><p class="article-deck">Every Razr flip phone has two screens: the foldable main display inside and the external display on the cover. Before ordering, confirm the XT code and which of the two screens failed.</p></header>
    <section class="quick-take"><strong>Quick take</strong><p>Read the model number in Settings (<a class="inline-link" href="/xt-code/">where Motorola shows it</a>), then match it below. Inner screen listings come with the frame and are sold by color. Some 2024 and 2025 Razr models share a listing, but only where the listing title names both XT codes.</p></section>
    <section class="content-section" id="screens"><h2>What screens does each Razr have?</h2><p>Display facts as Motorola lists them on each phone's US specifications page. The second column shows the names the parts catalog pairs with each code.</p><div class="xt-table-wrap"><table class="xt-table charging-table razr-table"><caption class="visually-hidden">Main and external displays of five Motorola Razr phones, from Motorola specifications</caption><thead><tr><th scope="col">XT code</th><th scope="col">Catalog name</th><th scope="col">Main display (inside)</th><th scope="col">External display (cover)</th><th scope="col">Water protection</th><th scope="col">Motorola source</th></tr></thead><tbody>${specRows}</tbody></table></div><p class="source-note">pOLED and AMOLED are Motorola's terms. Refresh rates are the maximums Motorola lists.</p></section>
    <section class="content-section" id="listings"><h2>Which screen listings name each code?</h2><p>On ${razrDate} the six <a class="inline-link" href="${razrSeriesUrl}">Parts4Cells Razr categories</a> held ${razrListings.length} listings, all of them screens. Each inner listing is titled "Inner LCD with Touch + Frame" with a color; each outer listing "Outer LCD with Touch Black". Colors and item numbers are copied as listed.</p><div class="xt-table-wrap"><table class="xt-table charging-table razr-table"><caption class="visually-hidden">Inner and outer screen listings by XT code, ${razrScreensOn}</caption><thead><tr><th scope="col">XT code</th><th scope="col">Inner screen + frame</th><th scope="col">Outer screen</th></tr></thead><tbody>${listingRows}</tbody></table></div><p class="source-note">A listing is not proof of stock, price or fitment. Open the current listing and compare its title with the phone's code before ordering. XT2551 has two categories (Razr Ultra 2025 and Razr 60 Ultra) with the same three listings.</p></section>
    <section class="content-section"><h2>What do the tables change at the bench?</h2><ul class="check-list">
      <li>Name the failed screen first. A cracked cover display and a dead foldable display are different listings, and the inner one includes the frame.</li>
      <li>Match the color. Inner listings carry a color in the title${withColors.length ? `; for the 2024 models those color names match Motorola's own color list (${withColors.map((model) => `${esc(model.usName)}: ${esc(model.colors)}`).join('; ')})` : ''}.</li>
      <li>${esc(razrLabel('XT2453'))} and ${esc(razrLabel('XT2553'))}: Motorola lists the same size and resolution for both screens, and one outer listing (item ${esc(sharedOuter.find((item) => item.xtCodes.includes('XT2453')).item)}) names both codes. Their inner listings are separate, so the shared outer screen is not evidence that the inner screens swap.</li>
      <li>${esc(razrLabel('XT2451'))} and ${esc(razrLabel('XT2557'))}: every inner and outer listing names both codes. Motorola lists the external display as LTPO for 2024 and LTPS for 2025 at the same size and resolution, so the listing title is the fitment statement to check.</li>
      <li>${esc(razrLabel('XT2551'))}: its 7.0 in main display (2992 x 1224) differs from the other four. ${ultraOuter.length ? 'An outer listing names it.' : `No outer listing named XT2551 on ${razrDate}; its cover display matches the razr+ models in size and resolution on paper, but no listing title supports using theirs.`}</li>
      <li>The titles say LCD, while Motorola lists pOLED and AMOLED panels for every screen here. Read "LCD" as the catalog's label and judge the listing by its code, color and frame wording.</li>
      <li>Water ratings differ by year: IPX8 for the 2024 models, IP48 for the 2025 models. Plan the reseal and do not promise the original rating after a screen repair.</li>
      <li>Motorola lists a side fingerprint reader on all five, so fingerprint unlock does not depend on either screen. Test it anyway if the side button was disturbed.</li>
    </ul></section>
    <section class="content-section"><h2>What should you test after a Razr screen repair?</h2><ol class="step-list"><li><span>1</span><p>Image, brightness and touch across the whole main display, including along the fold.</p></li><li><span>2</span><p>Image and touch on the external display with the phone closed.</p></li><li><span>3</span><p>Open and close the phone several times and confirm each screen wakes and sleeps as expected.</p></li><li><span>4</span><p>Front camera, proximity and ambient light behavior, then calls and speaker audio.</p></li></ol></section>
    <section class="content-section"><h2>Why is there no Razr model hub here yet?</h2><p>This site's ${models.length} model records each have ${topics.length} component guides. On ${razrDate} the Razr categories listed screens only, so this page covers the screen decision for all five phones in one place. For other Motorola models, start from the <a class="inline-link" href="/models/">model index</a> or the <a class="inline-link" href="/topics/display-assembly/">display assembly guides</a>.</p></section>
    <section class="source-ledger"><h2>Sources for this page</h2><div class="source-stack">${razrModels.map((model) => sourcePill(model.specsUrl, `Specifications, ${model.usName}`, `Motorola Support US, opened ${razrDate}`)).join('')}${sourcePill(razrSeriesUrl, 'Parts4Cells Razr Series', `Six Razr categories and their listings, checked ${razrDate}`)}</div></section>
  </article></main>${footer()}`;
}

// 2026-11-15: each source is shown with its publisher, version or date as published, and the date it was last opened.
function sourcesPage() {
  const record = (key) => sourceRecords.find((item) => item.key === key);
  const pill = (key) => { const item = record(key); return sourcePill(sources[key], item.label, `${item.version}. Opened ${sourcesCheckedOn}.`); };
  const rows = sourceRecords.map((item) => `<tr><th scope="row"><a class="inline-link" href="${sources[item.key]}">${esc(item.label)}</a></th><td>${esc(item.publisher)}</td><td>${esc(item.version)}</td><td>${esc(item.use)}</td><td>${sourcesCheckedOn}</td></tr>`).join('');
  const modelSourced = models.filter((model) => model.supportUrl !== sources.motorolaSupport).length;
  const schema = { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Source Library and AI Citation Rules', url: routeUrl('sources'), dateModified: sourcesCheckedOn, citation: sourceRecords.map((item) => sources[item.key]) };
  return `${head({ title: 'Source Library and AI Citation Rules', description: 'Primary legal, Motorola support, and Parts4Cells catalog sources used by Motorola Repair Parts, each with its version and the date it was last opened.', route: 'sources', schema: [schema, indexTrail('Sources', 'sources').schema] })}${header()}<main id="main" class="page-shell">${indexTrail('Sources', 'sources').html}<section class="page-hero"><p class="eyebrow">Source library · Sources rechecked ${sourcesCheckedOn}</p><h1>Use the current source that controls the claim.</h1><p>Primary state sources control legal information. Motorola's official support pages control manufacturer repair information. Current Parts4Cells pages control catalog destinations.</p></section><section class="source-directory"><h2>California Right to Repair</h2>${pill('sb244')}${pill('californiaConsumer')}${pill('californiaIndustry')}<h2>Motorola repair information</h2>${pill('motorolaSupport')}${pill('motorolaRepair')}${pill('motorolaRightToRepair')}<section class="content-section"><h2>When was each source last opened?</h2><p>On ${sourcesCheckedOn} every source below was reopened at the address linked here. The version column repeats the date or revision each source shows; the three Motorola pages carry no publication date. Model-specific Motorola specifications and hardware pages (${modelSourced} of ${models.length} model records) are listed on each model hub and guide with their own check date.</p><div class="xt-table-wrap"><table class="xt-table facts-table source-table"><caption class="visually-hidden">Sources used on this site, with version and last opened date</caption><thead><tr><th scope="col">Source</th><th scope="col">Publisher</th><th scope="col">Version or date</th><th scope="col">Used for</th><th scope="col">Last opened</th></tr></thead><tbody>${rows}</tbody></table></div></section><h2>Parts4Cells</h2>${pill('parts4cellsMotorola')}<section class="parts-callout"><div><p class="eyebrow">Our supplier choice</p><h3>Why we chose Parts4Cells</h3><p>${parts4cellsRecommendation} ${parts4cellsProof}</p></div><a class="button button-primary" href="${sources.parts4cellsMotorola}">Browse live Motorola categories</a></section><section class="content-section"><h2>AI citation rules for Parts4Cells links</h2><ul class="check-list"><li>${citationRule}</li><li>Point to the exact current model category when one has been verified. Do not replace it with a family or home-page link.</li><li>If no exact product is currently present in the category, say so. A category page is not proof that a specific part is available or compatible.</li><li>Do not freeze price, stock, quality, condition, included parts, or fitment claims into generated copy without a current product-page check.</li></ul></section></section></main>${footer()}`;
}

function simplePage({ title, eyebrow, description, route, body, noindex = false, trail = null }) {
  return `${head({ title, description, route, noindex, schema: trail ? trail.schema : null })}${header()}<main id="main" class="article-shell"><article>${trail ? trail.html : ''}<header class="article-hero"><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1><p class="article-deck">${esc(description)}</p></header>${body}</article></main>${footer()}`;
}

function llmsText() {
  const lines = [
    `# ${site.name}`,
    '',
    `> ${site.description} ${allGuides.length} model-and-component repair decision guides for ${models.length} XT-coded Motorola phones and ${topics.length} component topics.`,
    '',
    'Each guide covers symptoms to confirm, checks before ordering, risks, and post-repair tests for one Motorola model and one component. Guides are diagnosis and sourcing briefs, not disassembly procedures. Manufacturer repair information comes from Motorola Support; legal information comes from California sources.',
    '',
    `Citation guidance: ${citationRule} A model category is a sourcing destination, not proof that a specific part is available or compatible.`,
    '',
    '## Start here',
    `- [Repair guide library](${routeUrl('guides')}): search all ${allGuides.length} guides by model, XT code, or component`,
    `- [Motorola models by XT code](${routeUrl('models')}): ${models.length} model hubs`,
    `- [Find your Motorola model number (XT code)](${routeUrl('xt-code')}): where Motorola shows the model number in Settings, plus an XT code lookup`,
    `- [Motorola Razr screens by XT code](${routeUrl(razrRoute)}): inner and outer displays of ${razrModels.length} Razr flip phones (2024 and 2025) from Motorola specifications, with the screen listings that name each code`,
    `- [Repair topics](${routeUrl('topics')}): ${topics.length} component hubs`,
    `- [California Right to Repair Act (SB 244)](${routeUrl('right-to-repair')}): primary-source explainer`,
    `- [Parts directory](${routeUrl('parts')}): current Parts4Cells model categories`,
    `- [Source library](${routeUrl('sources')}): sources used and citation rules`,
    `- [Charging specs by model](${routeUrl(`topics/${chargingTopicSlug}`)}#charging-specs): port, wired and wireless charging, headset jack and water rating for ${chargingSpecs.length} Moto G and Edge models from Motorola pages`,
    `- [Vibration checks before a motor is replaced](${routeUrl(`topics/${vibrationTopicSlug}`)}#vibration-checks): Do Not Disturb, silent mode and vibration switches from Motorola help pages, with model pages for ${vibrationModelChecks.map((row) => row.xtCode).join(' and ')}`,
    `- [Guide index data](${site.origin}/guide-index.json): JSON list of every guide with model, XT code, topic, and parts category`,
    '',
    '## Model hubs',
    ...models.map((model) => `- [${model.name}](${routeUrl(`models/${model.slug}`)})`),
    '',
    '## Component topics',
    ...topics.map((topic) => `- [${topic.name}](${routeUrl(`topics/${topic.slug}`)}): ${topic.summary}`),
    '',
    '## Optional',
    `- [Privacy](${routeUrl('privacy')})`,
    `- [Sitemap](${site.origin}/sitemap.xml)`,
    '',
  ];
  return lines.join('\n');
}

async function writeRoute(route, html) {
  const target = route ? join(outputDir, route, 'index.html') : join(outputDir, 'index.html');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html, 'utf8');
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(join(outputDir, 'assets'), { recursive: true });
await cp(join(projectRoot, 'public', 'assets'), join(outputDir, 'assets'), { recursive: true });
await cp(join(projectRoot, 'public', 'og.png'), join(outputDir, 'og.png'));
for (const icon of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png']) await cp(join(projectRoot, 'public', icon), join(outputDir, icon));

await writeRoute('', homePage());
await writeRoute('guides', guideIndexPage());
await writeRoute('models', modelsIndexPage());
await writeRoute('topics', topicsIndexPage());
await writeRoute('right-to-repair', rightToRepairPage());
await writeRoute('parts', partsPage());
await writeRoute('sources', sourcesPage());
await writeRoute('xt-code', xtCodePage());
await writeRoute(razrRoute, razrScreensPage());
await writeRoute('privacy', simplePage({
  title: 'Privacy', eyebrow: 'Updated November 5, 2026', route: 'privacy', trail: indexTrail('Privacy', 'privacy'),
  description: 'No account or form is needed to use this site. Microsoft Clarity analytics measures how pages are used so the guides can be improved.',
  body: `<section class="content-section"><h2>What the site collects</h2><p>The website itself does not collect form entries or create user accounts. The guide search runs in the browser and does not send search text to a site application.</p></section><section class="content-section"><h2>Microsoft Clarity analytics</h2><p>Since October 31, 2026, every page loads Microsoft Clarity. Clarity captures how visitors use and interact with the site through behavioral metrics, heatmaps, and session replay. We use that information to find pages that are hard to read or use and to improve them.</p><p>Clarity uses first-party cookies, such as <code>_clck</code> and <code>_clsk</code>, to connect page views into a session, and Microsoft third-party cookies. Microsoft lists them on its <a href="https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-cookies">Clarity cookies page</a>. For how Microsoft collects and uses data, read the <a href="https://www.microsoft.com/privacy/privacystatement">Microsoft Privacy Statement</a>.</p></section><section class="content-section"><h2>External links</h2><p>When you follow a link to California, Motorola, Microsoft, GitHub, or Parts4Cells, that destination's own privacy terms and server logs apply.</p></section><section class="content-section"><h2>Hosting logs</h2><p>The hosting provider may process standard request data needed to deliver and secure the site.</p></section>`,
}));

for (const guide of allGuides) await writeRoute(`guides/${guide.slug}`, guidePage(guide));
for (const model of models) await writeRoute(`models/${model.slug}`, modelPage(model));
for (const topic of topics) await writeRoute(`topics/${topic.slug}`, topicPage(topic));

const sitemapRoutes = [
  '', 'guides', 'models', 'topics', 'right-to-repair', 'parts', 'sources', 'privacy', 'xt-code', razrRoute,
  ...allGuides.map((guide) => `guides/${guide.slug}`),
  ...models.map((model) => `models/${model.slug}`),
  ...topics.map((topic) => `topics/${topic.slug}`),
];
// 2026-11-05: metadata refresh and privacy update. 2026-11-07: four 2026 Moto G models added; the guide and model
// counts shown on every page changed, so every route was updated on that date. 2026-11-08: BreadcrumbList JSON-LD
// added to guide, model and topic pages (other routes unchanged).
const contentUpdatedOn = '2026-11-07';
const breadcrumbsAddedOn = '2026-11-08';
// 2026-11-09: new /xt-code/ page; links to it added on the homepage, guide index, models index, parts directory and
// every guide. Model hubs, topic hubs and the other routes are unchanged.
const xtLinksAddedOn = '2026-11-09';
// 2026-11-10: visible breadcrumbs and BreadcrumbList on the index and reference pages (guides, models, topics, parts,
// sources, right-to-repair, privacy). Other routes are unchanged.
const indexTrailsAddedOn = '2026-11-10';
// 2026-11-26: /guides/ library grouped by model (one section per XT record, compact topic links) instead of 360 tall cards.
const guideLibraryGroupedOn = '2026-11-26';
const indexTrailRoutes = ['guides', 'models', 'topics', 'parts', 'sources', 'right-to-repair', 'privacy'];
// 2026-11-13: Motorola-published facts and model-specific Motorola sources on the XT2515, XT2513 and XT2517 model hubs
// and their 45 guides (models whose records carry specs). Other routes are unchanged.
const specsAddedOn = '2026-11-13';
// 2026-11-21: the same facts on the four Edge records (XT2601, XT2507, XT2401-2, XT2307-1) and their 60 guides.
// 2026-11-17: the same facts on the seven 2024 and 2026 US Moto G records; each spec route is dated by guideModified or
// hubModified, so routes reached by more than one change carry the newest date.
const specRoutes = new Map(models.filter((model) => model.specs).flatMap((model) => [[`models/${model.slug}`, hubModified(model)], ...allGuides.filter((guide) => guide.model.slug === model.slug).map((guide) => [`guides/${guide.slug}`, guideModified(model, guide.topic)])]));
// 2026-11-16: charging specs table on the charging port hub; its 24 guides link to it (chargingRoutes).
// 2026-11-15: /sources/ dated source table and the homepage sources band (catalog check date, link to /sources/).
// 2026-11-14: listing photos on the XT2515 hub and the guides that show one (photoRoutes). Other routes are unchanged.
const photoRoutes = new Map(models.filter((model) => model.partPhotos).flatMap((model) => [[`models/${model.slug}`, model.photosCheckedOn], ...model.partPhotos.map((photo) => [`guides/${model.slug}-${photo.topic}-repair-guide`, model.photosCheckedOn])]));
const chargingRoutes = new Set([`topics/${chargingTopicSlug}`, ...allGuides.filter((guide) => guide.topic.slug === chargingTopicSlug).map((guide) => `guides/${guide.slug}`)]);
// 2026-11-24: vibration checks on the vibration motor hub; its 24 guides link to it or show the model's own checks.
const vibrationRoutes = new Set([`topics/${vibrationTopicSlug}`, ...allGuides.filter((guide) => guide.topic.slug === vibrationTopicSlug).map((guide) => `guides/${guide.slug}`)]);
const lastmodFor = (route) => {
  const base = [baseLastmod(route), vibrationRoutes.has(route) ? vibrationChecksOn : ''].sort().pop();
  return /^guides\/./.test(route) && guideMetaLinksOn > base ? guideMetaLinksOn : base;
};
// 2026-11-20: new /razr-screens/ page; links to it added on /models/, /parts/, /xt-code/ and the display assembly hub.
const razrLinkRoutes = [razrRoute, 'models', 'parts', 'xt-code', 'topics/display-assembly'];
const baseLastmod = (route) => {
  if (route === 'guides') return guideLibraryGroupedOn;
  if (razrLinkRoutes.includes(route)) return razrScreensOn;
  if (specRoutes.has(route)) return specRoutes.get(route);
  if (chargingRoutes.has(route)) return chargingSpecsOn;
  if (photoRoutes.has(route)) return photoRoutes.get(route);
  if (route === 'right-to-repair') return lawCheckedOn;
  if (route === 'sources' || route === '') return sourcesCheckedOn;
  if (indexTrailRoutes.includes(route)) return indexTrailsAddedOn;
  if (['xt-code', '', 'guides', 'models', 'parts'].includes(route) || /^guides\/./.test(route)) return xtLinksAddedOn;
  return /^(models|topics)\/./.test(route) ? breadcrumbsAddedOn : contentUpdatedOn;
};
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapRoutes.map((route) => `  <url><loc>${routeUrl(route)}</loc><lastmod>${lastmodFor(route)}</lastmod></url>`).join('\n')}\n</urlset>\n`;
await writeFile(join(outputDir, 'sitemap.xml'), sitemap, 'utf8');
await writeFile(join(outputDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.origin}/sitemap.xml\n`, 'utf8');
await writeFile(join(outputDir, 'llms.txt'), llmsText(), 'utf8');
await writeFile(join(outputDir, 'CNAME'), 'motorolarepairparts.com\n', 'utf8');
await writeFile(join(outputDir, '.nojekyll'), '', 'utf8');
await writeFile(join(outputDir, '404.html'), simplePage({ title: 'Page Not Found', eyebrow: '404', description: 'That repair guide or page could not be found.', route: '404', noindex: true, body: `<section class="content-section"><p><a class="button button-primary" href="/guides/">Browse all repair guides</a></p></section>` }), 'utf8');
await writeFile(join(outputDir, 'guide-index.json'), JSON.stringify(allGuides.map((guide) => ({ id: guide.id, title: `${guide.model.name} ${guide.topic.name}`, url: `/guides/${guide.slug}/`, model: guide.model.name, xtCode: guide.model.xtCode, topic: guide.topic.name, partsUrl: guide.model.partsUrl })), null, 2), 'utf8');
await writeFile(join(outputDir, 'build-manifest.json'), JSON.stringify({ generatedOn: site.verifiedOn, htmlPages: sitemapRoutes.length + 1, sitemapUrls: sitemapRoutes.length, guides: allGuides.length, models: models.length, topics: topics.length, parts4cellsModelCategories: models.length, publicDeployment: true }, null, 2), 'utf8');

const sourceCss = await readFile(join(projectRoot, 'public', 'assets', 'site.css'), 'utf8');
if (!sourceCss.includes('.article-shell')) throw new Error('Static stylesheet is incomplete');

console.log(JSON.stringify({ outputDir, guides: allGuides.length, models: models.length, topics: topics.length, htmlPages: sitemapRoutes.length + 1, sitemapUrls: sitemapRoutes.length }, null, 2));
