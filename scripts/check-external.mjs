import { models, sources } from '../content/site-data.mjs';

const checks = [
  ...Object.entries(sources).map(([label, url]) => ({ label, url, catalog: url.includes('parts4cells.com'), networkOptional: url.includes('bhgs.dca.ca.gov') })),
  ...models.map((model) => ({ label: `${model.name} Parts4Cells category`, url: model.partsUrl, catalog: true, exactModel: true })),
];

function normalized(url) {
  return url.replace(/\/$/, '').toLowerCase();
}

async function inspect(check) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(check.url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; MotorolaRepairPartsLinkAudit/1.0)' },
    });
    await response.body?.cancel();
    const reachable = response.status >= 200 && response.status < 500 && response.status !== 404;
    return {
      ...check,
      status: response.status,
      finalUrl: response.url,
      reachable,
      unchanged: normalized(response.url) === normalized(check.url),
    };
  } catch (error) {
    return { ...check, status: null, finalUrl: null, reachable: false, unchanged: false, error: error.message };
  } finally {
    clearTimeout(timeout);
  }
}

const results = [];
for (let index = 0; index < checks.length; index += 5) {
  results.push(...await Promise.all(checks.slice(index, index + 5).map(inspect)));
}

const failed = results.filter((result) => !result.reachable);
const requiredFailures = failed.filter((result) => !result.networkOptional);
const changedModelCategories = results.filter((result) => result.exactModel && !result.unchanged);
const modelResults = results.filter((result) => result.exactModel);
const summary = {
  checkedOn: new Date().toISOString(),
  total: results.length,
  reachable: results.filter((result) => result.reachable).length,
  failed: failed.length,
  requiredFailures: requiredFailures.length,
  networkOptionalFailures: failed.filter((result) => result.networkOptional).length,
  modelCategories: modelResults.length,
  modelCategoriesReachable: modelResults.filter((result) => result.reachable).length,
  modelCategoriesUnchanged: modelResults.filter((result) => result.unchanged).length,
  changedModelCategories: changedModelCategories.length,
  results,
};

console.log(JSON.stringify(summary, null, 2));
if (requiredFailures.length || changedModelCategories.length) process.exitCode = 1;
