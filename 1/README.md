# Adult Site Blocker (v2, Manifest V3)

## Install (Chrome / Edge / Brave)
1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder.

## Features
- Blocks 50+ default sites and all their subdomains, and redirects to a "blocked" page
- **Pattern blocking:** brand names in `patterns.json` are matched against the hostname only, so `xvideos2.net`, `new.xhamster.org` or `pornhub.co.uk` are blocked even though they aren't in the domain list. Add your own patterns (regex allowed) in the popup
- Popup: master on/off switch, one-click "Block this site", add/remove your own domains
- Keyword blocking for unlisted sites (the page is hidden and replaced by the blocked page) (needs 5+ whole-word matches, so no "Essex" false positives)
- Custom sites sync across your signed-in browsers via `chrome.storage.sync`

## Files
- `background.js` builds the declarativeNetRequest rule on install, startup and any settings change
- `blocklist.json` default domains (edit freely)
- `patterns.json` default hostname patterns (RE2 regex syntax)
- `content.js` keyword detection
- `popup.*` settings UI, `blocked.html` the page shown when a site is blocked
