// Blocks a page if it contains several whole-word adult keywords. Requiring a few
// matches avoids false positives like "Essex" or a single mention in a news article.

const KEYWORDS = /\b(porn|porno|pornography|xxx|hentai|nsfw|onlyfans|adult videos?|sex videos?|sex tube)\b/gi;
const THRESHOLD = 5;
let blocked = false;

async function check() {
  if (blocked || !document.body) return;
  const { enabled = true, keywordBlocking = true } =
    await chrome.storage.sync.get(['enabled', 'keywordBlocking']);
  if (!enabled || !keywordBlocking) return;

  const matches = (document.body.innerText || '').match(KEYWORDS);
  if (!matches || matches.length < THRESHOLD) return;

  blocked = true;
  // Hide the page instantly so nothing is visible while the redirect happens.
  document.documentElement.style.setProperty('display', 'none', 'important');
  try {
    await chrome.runtime.sendMessage({ action: 'blockTab' });
  } catch {
    // Fallback if the background worker can't be reached: wipe the page.
    document.documentElement.style.removeProperty('display');
    document.body.replaceChildren(document.createTextNode('🚫 This page was blocked.'));
    document.body.style.cssText = 'font:20px system-ui;text-align:center;padding:20vh 0;';
  }
}

check();
setTimeout(check, 1500); // catch pages that render content late
setTimeout(check, 5000);
