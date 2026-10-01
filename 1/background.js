// Two layers of blocking, both via declarativeNetRequest:
//  1. Exact domains (+ all subdomains) from blocklist.json and the user's custom sites.
//  2. Regex patterns matched against the HOSTNAME only, so a site that changes its
//     subdomain, TLD or adds a number (xvideos.com -> xvideos2.net) is still caught.

const DEFAULTS = {
  enabled: true,
  customSites: [],
  patternBlocking: true,
  customPatterns: []
};

const DOMAIN_RULE_ID = 1;
const PATTERN_RULE_START = 100;

// Matches `body` anywhere in the host part of http(s) URLs (not path or query).
const hostRegex = body => `^https?://[^/?#]*(${body})`;

// Chrome limits the compiled size of each regex rule (~2KB). Try the whole group;
// if Chrome rejects it, split in half and retry. A single pattern that still fails
// is skipped (bad syntax or genuinely too large).
async function fitPatterns(list) {
  if (!list.length) return [];
  const body = list.join('|');
  const { isSupported, reason } = await chrome.declarativeNetRequest.isRegexSupported({
    regex: hostRegex(body)
  });
  if (isSupported) return [body];
  if (list.length === 1) {
    console.warn('Skipping unsupported pattern:', body, '-', reason);
    return [];
  }
  const mid = Math.ceil(list.length / 2);
  return [...(await fitPatterns(list.slice(0, mid))), ...(await fitPatterns(list.slice(mid)))];
}

async function buildRules(s) {
  const rules = [];
  const types = ['main_frame', 'sub_frame'];
  const action = { type: 'redirect', redirect: { extensionPath: '/blocked.html' } };

  // Layer 1: exact domains
  const defaults = await (await fetch(chrome.runtime.getURL('blocklist.json'))).json();
  const domains = [...new Set([...defaults, ...s.customSites])].filter(Boolean);
  if (domains.length) {
    rules.push({
      id: DOMAIN_RULE_ID, priority: 1, action,
      condition: { requestDomains: domains, resourceTypes: types }
    });
  }

  // Layer 2: regex patterns
  if (s.patternBlocking) {
    const builtin = await (await fetch(chrome.runtime.getURL('patterns.json'))).json();
    const bodies = await fitPatterns(builtin);
    // Each custom pattern is its own rule so one bad pattern can't break the rest.
    for (const p of s.customPatterns) bodies.push(...(await fitPatterns([p])));

    let id = PATTERN_RULE_START;
    for (const body of bodies) {
      rules.push({
        id: id++, priority: 1, action,
        condition: { regexFilter: hostRegex(body), resourceTypes: types }
      });
    }
  }
  return rules;
}

async function syncRules() {
  const s = await chrome.storage.sync.get(DEFAULTS);
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const addRules = s.enabled ? await buildRules(s) : [];

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map(r => r.id),
    addRules
  });

  chrome.action.setBadgeText({ text: s.enabled ? '' : 'OFF' });
  chrome.action.setBadgeBackgroundColor({ color: '#c0392b' });
}

chrome.runtime.onInstalled.addListener(syncRules);
chrome.runtime.onStartup.addListener(syncRules);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (['enabled', 'customSites', 'patternBlocking', 'customPatterns'].some(k => changes[k])) syncRules();
});

// Content script asks us to replace a tab whose text looked like adult content.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (sender.id === chrome.runtime.id && sender.tab && msg && msg.action === 'blockTab') {
    chrome.tabs.update(sender.tab.id, { url: chrome.runtime.getURL('blocked.html') });
  }
});
