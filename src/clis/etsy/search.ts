import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { EmptyResultError } from '../../errors.js';
import { waitForContent } from './_shared/helpers.js';
import type { EtsySearchItem } from './types.js';

cli({
  site: 'etsy',
  name: 'search',
  description: '搜索 Etsy 商品，返回列表（PID/标题/价格/缩略图/店铺）',
  domain: 'www.etsy.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'query', required: true, help: '搜索关键词' },
    { name: 'limit', type: 'int', default: 20, help: '最大返回数量' },
    { name: 'scroll', type: 'int', default: 3, help: '滚动加载次数' },
  ],
  columns: ['pid', 'title', 'price', 'shop', 'thumbnail'],

  func: async (page: IPage, kwargs) => {
    const query = String(kwargs.query);
    const limit = Number(kwargs.limit) || 20;
    const scrollCount = Number(kwargs.scroll) || 3;

    const url = `https://www.etsy.com/search?q=${encodeURIComponent(query)}`;
    await page.goto(url);
    await waitForContent(page, 6000);

    // Scroll to load more results
    for (let i = 0; i < scrollCount; i++) {
      await page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
      await waitForContent(page, 2000);
    }

    // Extract using proper Etsy selectors
    const items: EtsySearchItem[] = await page.evaluate(`(() => {
      var cards = document.querySelectorAll('div.v2-listing-card[data-listing-id]');
      var results = [];
      var seen = {};

      cards.forEach(function(c) {
        var id = c.getAttribute('data-listing-id');
        if (!id || seen[id]) return;
        seen[id] = true;

        var titleEl = c.querySelector('.v2-listing-card__title');
        var priceEl = c.querySelector('.currency-value');
        var shopEl = c.querySelector('.v2-listing-card__shop');
        var imgEl = c.querySelector('img');
        var linkEl = c.querySelector('a[href*="/listing/"]');

        var title = titleEl ? titleEl.textContent.trim() : '';
        if (!title || title.length < 5) return;

        var price = priceEl ? priceEl.textContent.trim() : '';
        var shop = shopEl ? shopEl.textContent.trim() : '';
        var img = imgEl ? imgEl.src : '';
        var href = linkEl ? linkEl.getAttribute('href') : '';

        // Detect ads: check parent chain for ad markers
        var isAd = false;
        var parent = c.parentElement;
        while (parent && parent !== document.body) {
          if (parent.getAttribute('data-search-results-id') === 'ad') { isAd = true; break; }
          parent = parent.parentElement;
        }

        results.push({
          pid: id,
          title: title.substring(0, 150),
          price: price,
          shop: shop,
          thumbnail: img,
          url: href,
          is_ad: isAd
        });
      });

      return results;
    })()`);

    // Filter out ads, apply limit
    const organic = items.filter((r) => !(r as unknown as Record<string, unknown>).is_ad);
    if (organic.length === 0) {
      throw new EmptyResultError('etsy search', `No organic results found for "${query}". Try different keywords or increase --scroll.`);
    }

    return organic.slice(0, limit);
  },
});
