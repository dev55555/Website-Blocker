const $ = id => document.getElementById(id);

// "https://www.Example.com/path?x=1" -> "example.com"; returns null if invalid.
function normalizeDomain(input) {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  try { s = new URL(s.includes('://') ? s : 'https://' + s).hostname; } catch { return null; }
  s = s.replace(/^www\./, '');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : null;
}

async function getState() {
  return chrome.storage.sync.get({ enabled: true, customSites: [], keywordBlocking: true, patternBlocking: true, customPatterns: [] });
}

function showError(msg) { $('error').textContent = msg || ''; }

async function addSite(raw) {
  const domain = normalizeDomain(raw);
  if (!domain) return showError('Enter a valid domain, e.g. example.com');
  const { customSites } = await getState();
  if (customSites.includes(domain)) return showError(domain + ' is already blocked');
  await chrome.storage.sync.set({ customSites: [...customSites, domain] });
  showError('');
  $('new-site').value = '';
  render();
}

async function removeSite(domain) {
  const { customSites } = await getState();
  await chrome.storage.sync.set({ customSites: customSites.filter(d => d !== domain) });
  render();
}

async function addPattern(raw) {
  const p = raw.trim();
  const err = msg => ($('pattern-error').textContent = msg || '');
  if (p.length < 3) return err('Pattern must be at least 3 characters');

  const regex = '^https?://[^/?#]*(' + p + ')';
  const { isSupported, reason } = await chrome.declarativeNetRequest.isRegexSupported({ regex });
  if (!isSupported) return err('Unsupported regex' + (reason ? ' (' + reason + ')' : ''));

  // Safety check: refuse patterns that would block everyday sites.
  let re;
  try { re = new RegExp(regex, 'i'); } catch { return err('Invalid regex'); }
  const safe = ['https://example.com/', 'https://www.google.com/', 'https://en.wikipedia.org/', 'https://github.com/'];
  if (safe.some(u => re.test(u))) return err('Too broad: it would block common sites');

  const { customPatterns } = await getState();
  if (customPatterns.includes(p)) return err('Pattern already added');
  await chrome.storage.sync.set({ customPatterns: [...customPatterns, p] });
  err('');
  $('new-pattern').value = '';
  render();
}

async function removePattern(p) {
  const { customPatterns } = await getState();
  await chrome.storage.sync.set({ customPatterns: customPatterns.filter(x => x !== p) });
  render();
}

function fillList(listEl, items, onRemove) {
  listEl.replaceChildren();
  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'None yet';
    listEl.appendChild(li);
  }
  for (const item of items) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = item; // textContent, never innerHTML
    const btn = document.createElement('button');
    btn.textContent = '×';
    btn.title = 'Remove';
    btn.addEventListener('click', () => onRemove(item));
    li.append(name, btn);
    listEl.appendChild(li);
  }
}

async function render() {
  const { enabled, customSites, keywordBlocking, patternBlocking, customPatterns } = await getState();
  $('pattern-on').checked = patternBlocking;
  fillList($('pattern-list'), customPatterns, removePattern);
  $('enabled').checked = enabled;
  $('keywords').checked = keywordBlocking;
  $('status').textContent = enabled ? 'Protection is ON' : 'Protection is OFF';

  fillList($('site-list'), customSites, removeSite);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const current = tab && tab.url && /^https?:/.test(tab.url) ? normalizeDomain(tab.url) : null;
  $('block-current').disabled = !current || customSites.includes(current);
  $('block-current').textContent = current ? 'Block ' + current : 'Block this site';
  $('block-current').dataset.domain = current || '';
}

$('enabled').addEventListener('change', e => chrome.storage.sync.set({ enabled: e.target.checked }).then(render));
$('keywords').addEventListener('change', e => chrome.storage.sync.set({ keywordBlocking: e.target.checked }));
$('pattern-on').addEventListener('change', e => chrome.storage.sync.set({ patternBlocking: e.target.checked }));
$('add-pattern').addEventListener('click', () => addPattern($('new-pattern').value));
$('new-pattern').addEventListener('keydown', e => { if (e.key === 'Enter') addPattern(e.target.value); });
$('add-site').addEventListener('click', () => addSite($('new-site').value));
$('new-site').addEventListener('keydown', e => { if (e.key === 'Enter') addSite(e.target.value); });
$('block-current').addEventListener('click', e => addSite(e.target.dataset.domain));

render();
