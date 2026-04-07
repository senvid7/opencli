import { cli, Strategy } from '@jackwener/opencli/registry';
import type { IPage } from '@jackwener/opencli/types';
import { EmptyResultError } from '@jackwener/opencli/errors';
import { waitForContent, extractBasicInfo, extractDetailInfo } from './_shared/helpers.js';
import type { EtsyProductDetail } from './types.js';

cli({
  site: 'etsy',
  name: 'product',
  description: '采集 Etsy 商品完整数据（标题/价格/图片/销量/评论/描述/物流/店铺）',
  domain: 'www.etsy.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'pid', required: true, help: 'Etsy 商品 ID 或完整 URL' },
  ],
  columns: ['pid', 'title', 'price', 'shop', 'signals', 'origin', 'region', 'imgs_count', 'reviews_count'],

  func: async (page: IPage, kwargs) => {
    const pid = String(kwargs.pid).replace(/^https?:\/\/.*?\/listing\//, '').split(/[/?#]/)[0];
    const url = `https://www.etsy.com/listing/${pid}`;

    // Navigate to product page
    await page.goto(url);
    await waitForContent(page, 6000);

    // Scroll down to trigger lazy-loaded content (price, description, reviews)
    await page.evaluate(`window.scrollTo(0, 800)`);
    await waitForContent(page, 2000);
    await page.evaluate(`window.scrollTo(0, document.body.scrollHeight * 0.6)`);
    await waitForContent(page, 2000);
    await page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
    await waitForContent(page, 2000);

    // Phase 1: basic info
    let basic = await extractBasicInfo(page);
    if (!basic.title) {
      await waitForContent(page, 4000);
      basic = await extractBasicInfo(page);
    }
    if (!basic.title) {
      throw new EmptyResultError('etsy product', `Could not extract data for PID ${pid}. The listing may not exist or requires login.`);
    }

    // Phase 2: detail info (scroll to reviews section)
    await page.evaluate(`window.scrollTo(0, document.body.scrollHeight * 0.7)`);
    await waitForContent(page, 3000);
    let detail = await extractDetailInfo(page);
    if (!detail.reviews.length && !detail.desc) {
      await page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
      await waitForContent(page, 3000);
      detail = await extractDetailInfo(page);
    }

    // Merge into final result
    const result: EtsyProductDetail = {
      pid: basic.pid || pid,
      title: basic.title,
      shop: basic.shop,
      price: basic.price,
      signals: basic.signals,
      origin: basic.origin,
      material: basic.material,
      image_urls_raw: basic.imgs,
      review_count_raw: detail.reviewCountRaw,
      shop_stats_raw: detail.shopStatsRaw,
      reviews: detail.reviews,
      description: detail.desc,
      shipping: detail.ship,
      region: detail.region,
      category_raw: detail.categoryRaw,
      url,
    };

    // Provide table-friendly summary columns
    return [{
      ...result,
      imgs_count: String(basic.imgs.length),
      reviews_count: detail.reviewCountRaw,
    }];
  },
});
