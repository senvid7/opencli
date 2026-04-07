import { cli, Strategy } from '@jackwener/opencli/registry';
import type { IPage } from '@jackwener/opencli/types';
import { waitForContent } from './_shared/helpers.js';

cli({
  site: 'etsy',
  name: 'locale',
  description: '切换 Etsy 地域/语言/货币设置（如切换到英文美国区）',
  domain: 'www.etsy.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'region', help: '地区代码，如 US / JP / GB', default: 'US' },
    { name: 'lang', help: '语言代码，如 en-US / ja', default: 'en-US' },
    { name: 'currency', help: '货币代码，如 USD / JPY / EUR', default: 'USD' },
  ],

  func: async (page: IPage, kwargs) => {
    const region = String(kwargs.region || 'US');
    const lang = String(kwargs.lang || 'en-US');
    const currency = String(kwargs.currency || 'USD');

    // Step 1: Navigate to locale preferences page
    await page.goto('https://www.etsy.com/your/account/locale_preferences');
    await waitForContent(page, 5000);

    // Step 2: Get snapshot to find refs for selects and save button
    const snap = await page.snapshot({});

    // Find refs for the three selects
    const findRefBySelectName = (name: string): string | null => {
      const walk = (obj: any): string | null => {
        if (!obj || typeof obj !== 'object') return null;
        if (obj.ref && obj.name === name) return obj.ref;
        if (obj.role === 'combobox' && obj.name === name) return obj.ref;
        // aria-ref may differ; check label text mapping
        const nameToLabel: Record<string, string> = {
          region_code: 'Region',
          language_code: 'Language',
          currency_code: 'Currency',
        };
        if (obj.role === 'combobox' && obj.name === nameToLabel[name]) return obj.ref;
        for (const key of Object.keys(obj)) {
          const result = walk(obj[key]);
          if (result) return result;
        }
        return null;
      };
      return walk(snap);
    };

    const regionRef = findRefBySelectName('region_code');
    const langRef = findRefBySelectName('language_code');
    const currencyRef = findRefBySelectName('currency_code');

    // Step 3: Use evaluate to set select values with proper React-compatible events
    // React listens to the native 'input' event on selects (since React 16+)
    const selectResult = await page.evaluate(`(({ region, lang, currency }) => {
      function setSelectValue(name, value) {
        const sel = document.querySelector('select[name="' + name + '"]');
        if (!sel) return { found: false, error: 'select not found: ' + name };

        // Find matching option by value attribute
        let matched = false;
        for (const opt of sel.options) {
          if (opt.value === value || opt.value.toLowerCase() === value.toLowerCase()) {
            opt.selected = true;
            matched = true;
            break;
          }
        }
        if (!matched) {
          // Try matching by text content
          for (const opt of sel.options) {
            if (opt.textContent.trim().toLowerCase().indexOf(value.toLowerCase()) > -1) {
              opt.selected = true;
              matched = true;
              break;
            }
          }
        }
        if (!matched) return { found: true, error: 'no matching option for: ' + value + ' (available: ' + Array.from(sel.options).map(o => o.value).join(', ') + ')' };

        // Dispatch native events that React listens to
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return { found: true, selected: sel.value };
      }

      const r = setSelectValue('region_code', region);
      const l = setSelectValue('language_code', lang);
      const c = setSelectValue('currency_code', currency);
      return { region: r, lang: l, currency: c };
    })({ region: '${region}', lang: '${lang}', currency: '${currency}' })`);

    await waitForContent(page, 500);

    // Step 4: Click Save button — use snapshot to find the ref
    const snap2 = await page.snapshot({});
    const saveRef = findRefByAttr(snap2, 'Save');
    let clicked = 'not clicked';
    if (saveRef) {
      try {
        await page.click(saveRef);
        clicked = 'clicked via ref: ' + saveRef;
      } catch (e: any) {
        clicked = 'click failed: ' + (e.message || e);
      }
    } else {
      // Fallback: evaluate click
      clicked = await page.evaluate(`(() => {
        var btns = document.querySelectorAll('button[name="save"]');
        if (btns.length) { btns[0].click(); return 'clicked save button'; }
        var allBtns = document.querySelectorAll('button');
        for (var b of allBtns) {
          if (b.textContent.trim() === 'Save') { b.click(); return 'clicked Save text'; }
        }
        return 'no save button found';
      })()`);
    }

    // Step 5: Wait for page to navigate back
    await waitForContent(page, 3000);

    // Step 6: Verify — check footer locale link
    const verify = await page.evaluate(`(() => {
      // Try footer link: "United States | English (US) | $ (USD)"
      var links = document.querySelectorAll('a[href*="locale_preferences"]');
      for (var link of links) {
        var text = link.textContent || '';
        if (text.indexOf('|') > -1) {
          var parts = text.split('|').map(function(s) { return s.trim(); });
          return {
            method: 'footer',
            region: parts[0] || '',
            lang: parts[1] || '',
            currency: parts[2] || '',
            raw: text.trim(),
          };
        }
      }

      // Fallback: cookies
      var cookieRegion = '';
      var cm = document.cookie.match(/etsyp_region_pref=(\\w+)/);
      if (cm) cookieRegion = cm[1].toUpperCase();

      return { method: 'fallback', region: cookieRegion || 'unknown', lang: 'unknown', currency: 'unknown' };
    })()`);

    const success = verify.method === 'footer';

    return [{
      status: success ? 'success' : 'warning',
      target: region + ' / ' + lang + ' / ' + currency,
      select_result: selectResult,
      clicked: clicked,
      verified: verify,
      note: success
        ? 'Locale set to: ' + verify.raw
        : 'Could not verify. Check manually at https://www.etsy.com/your/account/locale_preferences',
    }];
  },
});

/** Walk the snapshot tree to find an element with matching text content */
function findRefByAttr(obj: any, text: string): string | null {
  if (!obj || typeof obj !== 'object') return null;
  if (obj.ref) {
    // Check direct text
    if (obj.text === text || obj.name === text) return obj.ref;
    // Check in content tree
    const walkText = (node: any): boolean => {
      if (typeof node === 'string' && node.trim() === text) return true;
      if (typeof node === 'string' && node.includes(text)) return true;
      if (typeof node === 'object' && node !== null) {
        if (Array.isArray(node)) return node.some(walkText);
        return Object.values(node).some(walkText);
      }
      return false;
    };
    if (walkText(obj)) return obj.ref;
  }
  for (const key of Object.keys(obj)) {
    if (key === 'ref') continue;
    const result = findRefByAttr(obj[key], text);
    if (result) return result;
  }
  return null;
}
