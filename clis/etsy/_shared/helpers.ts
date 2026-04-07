import type { IPage } from '@jackwener/opencli/types';
import type { EtsyProductBasic, EtsyReview } from '../types.js';

/** Wait for page content to settle */
export async function waitForContent(page: IPage, ms = 5000): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, ms));
}

/**
 * Extract PID from URL. Handles formats:
 *   /listing/12345
 *   /jp/listing/12345/bn-slug
 *   /listing/12345/slug
 */
export function extractPidFromUrl(url: string): string {
  const m = url.match(/\/listing\/(\d+)/);
  return m ? m[1] : '';
}

/** Extract product basic data — supports both EN and JA Etsy pages */
export async function extractBasicInfo(page: IPage): Promise<EtsyProductBasic> {
  const raw: EtsyProductBasic = await page.evaluate(`(() => {
    var h1 = document.querySelector('h1');
    var main = document.querySelector('main');
    var mt = main ? main.innerText : '';

    // PID from URL
    var pidMatch = location.pathname.match(/\\/listing\\/(\\d+)/);
    var pid = pidMatch ? pidMatch[1] : '';

    // Price — EN: "Sale Price $23.40" / JA: "価格：\\nUS$18.90+"
    var price = '';
    var priceJaM = mt.match(/(?:価格|Price)\\s*[:：]?\\s*\\n?\\s*(?:US)?[\\$\\u00a5\\u00a3￥]([\\d,.]+)/);
    var origJaM = mt.match(/(?:元の価格|Original Price)\\s*[:：]?\\s*\\n?\\s*(?:US)?[\\$\\u00a5\\u00a3￥]([\\d,.]+)/);
    var saleM = mt.match(/(?:Sale Price|セール価格)\\s*[\\$\\u00a5\\u00a3￥]([\\d,.]+)/);
    if (origJaM && priceJaM) {
      price = 'US$' + priceJaM[1] + '+ (Orig US$' + origJaM[1] + '+)';
    } else if (priceJaM) {
      price = (mt.indexOf('US$') > -1 ? 'US$' : '$') + priceJaM[1] + '+';
    } else if (saleM) {
      var origM = mt.match(/(?:Original Price|元の価格)\\s*[:：]?\\s*\\n?\\s*(?:US)?[\\$\\u00a5\\u00a3￥]([\\d,.]+)/);
      price = '$' + saleM[1] + (origM ? ' (Orig $' + origM[1] + ')' : '');
    } else {
      var yenM = mt.match(/￥([\\d,.]+)\\+/);
      if (yenM) price = '\\u00a5' + yenM[1] + '+';
    }

    // Sales signals
    var sig = [];
    if (/Bestseller|ベストセラー/i.test(mt)) sig.push('Bestseller');
    if (/Star Seller|スターセラー/i.test(mt)) sig.push('Star Seller');
    var favM = mt.match(/(\\d+)\\s*(?:favorites?|お気に入り)/i);
    if (favM) sig.push(favM[1] + ' favorites');
    var cartM = mt.match(/In (\\d+)\\+? (?:carts|カート)/);
    if (cartM) sig.push('In ' + cartM[1] + ' carts');
    var viewM = mt.match(/(\\d+)\\s*(?:views?|閲覧)/i);
    if (viewM) sig.push(viewM[1] + ' recent views');

    // Images
    var imgs = [];
    var seen = {};
    document.querySelectorAll('img').forEach(function(i) {
      var src = i.src;
      if (src && src.indexOf('etsystatic.com/') > -1 && src.indexOf('/il_') > -1) {
        var base = src.replace(/\\/\\d+x\\d+\\./, '/794xN.');
        if (!seen[base]) { seen[base] = 1; imgs.push(base); }
      }
    });

    // Origin — EN: "Ships from: Japan" / JA: "日本 へ発送"
    var origin = '';
    var shipEn = mt.match(/Ships from\\s*[:：]?\\s*([^\\n]+)/);
    if (shipEn) origin = shipEn[1].trim();
    if (!origin) {
      var shipJa = mt.match(/([\\u4e00-\\u9fff\\w]+)\\s*へ発送/);
      if (shipJa) origin = shipJa[1].trim();
    }

    // Material — EN: "Materials: jade" / JA: "素材"
    var material = '';
    var matM = mt.match(/(?:Materials?|素材)\\s*[:：]?\\s*([^\\n]{5,80})/);
    if (matM) material = matM[1].trim();
    var gemM = mt.match(/(?:Gemstone|宝石)\\s*[:：]?\\s*([^\\n]+)/);
    if (gemM) material += (material ? ', ' : '') + gemM[1].trim();

    var shopEl = document.querySelector('a[href*="/shop/"]');

    return {
      pid: pid,
      title: h1 ? h1.textContent.trim() : '',
      shop: shopEl ? shopEl.textContent.trim() : '',
      price: price,
      signals: sig.join(', '),
      origin: origin,
      material: material,
      imgs: imgs.filter(function(x){return x.indexOf('75x75')===-1}).slice(0, 10),
      url: location.href.split('?')[0]
    };
  })()`);

  return raw;
}

/** Extract detailed info — supports both EN and JA Etsy pages */
export async function extractDetailInfo(page: IPage): Promise<{
  reviewCountRaw: string;
  shopStatsRaw: string;
  reviews: EtsyReview[];
  desc: string;
  ship: string;
  region: string;
  categoryRaw: string;
}> {
  const raw = await page.evaluate(`(() => {
    var main = document.querySelector('main');
    var mt = main ? main.innerText : '';

    // Review count — EN: "4.9 Item average (42 reviews)" / JA: "星 5 個のうち 4.8 個"
    var reviewCountRaw = '';
    var reviewA = mt.match(/([\\d.]+)\\s*Item average\\s*\\(([\\d,.]+[kK]?\\s*reviews?)\\)/);
    var reviewJa = mt.match(/星\\s*5\\s*個のうち\\s*([\\d.]+)\\s*個/);
    var parenJa = mt.match(/レビューを見る|\\((\\d+(?:[,\\.]\\d+)?)\\)/);
    if (reviewA) {
      reviewCountRaw = reviewA[1] + '/5 stars, ' + reviewA[2];
    } else if (reviewJa) {
      reviewCountRaw = reviewJa[1] + '/5 stars' + (parenJa ? ', ' + parenJa[1] + ' reviews' : '');
    } else {
      var reviewB = mt.match(/(\\d+(?:\\.\\d+)?)\\s*\\/\\s*5/);
      var parenB = mt.match(/\\((\\d+)\\)/);
      if (reviewB) reviewCountRaw = reviewB[1] + '/5 stars' + (parenB ? ', ' + parenB[1] + ' reviews' : '');
    }

    // Shop stats — EN: "4.8 (3.5k) · 14.9k sales · 4 years" / JA: "4.8 (3.5k) · 14.9k 販売 · 4 年"
    var shopStatsRaw = '';
    var shopMatch = mt.match(/([\\d.]+)\\s*\\(([\\d,.]+[kK]?)\\)[\\s\\u00b7|]+([\\d,.]+k?)\\s*(?:sales|販売)[\\s\\u00b7|]+(\\d+)\\s*(?:years?|年)/);
    if (shopMatch) {
      shopStatsRaw = 'Rating:' + shopMatch[1] + ' Reviews:' + shopMatch[2] + ' Sales:' + shopMatch[3] + ' YearsOnEtsy:' + shopMatch[4];
    } else {
      var shopFallback = mt.match(/([\\d.]+)\\s*\\(([\\d,.]+[kK]?)\\)[\\s\\u00b7|]+([\\d,.]+k?)\\s*(?:sales|販売)/);
      if (shopFallback) {
        shopStatsRaw = 'Rating:' + shopFallback[1] + ' Reviews:' + shopFallback[2] + ' Sales:' + shopFallback[3];
      }
    }

    // Reviews — look for review section in both EN and JA
    var reviewIdx = Math.max(
      mt.indexOf('Reviews for this item'),
      mt.indexOf('この商品のレビュー')
    );
    var endReview = Math.max(
      mt.indexOf('View all reviews', reviewIdx),
      mt.indexOf('すべてのレビューを見る', reviewIdx)
    );
    var reviewText = reviewIdx > -1 ? mt.substring(reviewIdx, endReview > -1 ? endReview : reviewIdx + 5000) : '';
    // Universal review regex
    var revRegex = /(?:out of 5 stars|個のうち\\s*\\d)[\\s\\S]*?\\n([A-Za-z]+ [A-Za-z]+ \\d+, \\d+)[\\s\\S]*?\\n([\\s\\S]{20,500})/g;
    var reviews = [];
    var m;
    while ((m = revRegex.exec(reviewText)) !== null && reviews.length < 10) {
      var content = m[2].trim().substring(0, 500);
      if (content.length < 15) continue;
      reviews.push({
        rating_raw: 'extracted',
        date_raw: m[1],
        content_raw: content,
        selection_reason: 'product review'
      });
    }

    // Description — EN: "Item details" / JA: "商品の詳細" or "概要"
    var descIdx = Math.max(
      mt.indexOf('Item details'),
      mt.indexOf('商品の詳細'),
      mt.indexOf('概要')
    );
    var desc = '';
    if (descIdx > -1) {
      var ends = [
        mt.indexOf('Shipping and return', descIdx),
        mt.indexOf('配送および返品', descIdx),
        mt.indexOf('Reviews for this', descIdx),
        mt.indexOf('この商品のレビュー', descIdx)
      ].filter(function(x){return x > -1});
      var dEnd = ends.length ? Math.min.apply(null, ends) : descIdx + 3000;
      desc = mt.substring(descIdx, dEnd).trim().substring(0, 4000);
    }

    // Shipping — EN: "Shipping and return policies" / JA: "配送および返品ポリシー"
    var shipIdx = Math.max(
      mt.indexOf('Shipping and return'),
      mt.indexOf('配送および返品')
    );
    var ship = '';
    if (shipIdx > -1) {
      var sEnds = [
        mt.indexOf('Reviews for this', shipIdx),
        mt.indexOf('この商品のレビュー', shipIdx)
      ].filter(function(x){return x > -1});
      var sEnd = sEnds.length ? Math.min.apply(null, sEnds) : shipIdx + 500;
      ship = mt.substring(shipIdx, sEnd).trim();
    }

    // Region — from URL path (/jp/ = JP) or cookie
    var region = 'unknown';
    var pathMatch = location.pathname.match(/^\\/([a-z]{2})\\//);
    if (pathMatch) region = pathMatch[1].toUpperCase();
    var cookieMatch = document.cookie.match(/etsyp_region_pref=(\\w+)/);
    if (cookieMatch) region = cookieMatch[1].toUpperCase();

    // Category from breadcrumb
    var categoryRaw = '';
    var crumbs = document.querySelectorAll('nav[aria-label="Breadcrumb"] a, [data-breadcrumb] a');
    if (crumbs.length) {
      categoryRaw = Array.from(crumbs).map(function(a){return a.textContent.trim()}).join(' > ');
    }
    if (!categoryRaw) {
      var slug = location.pathname.split('/')[3] || '';
      categoryRaw = slug.replace(/-/g, ' ');
    }

    return {
      reviewCountRaw: reviewCountRaw,
      shopStatsRaw: shopStatsRaw,
      reviews: reviews,
      desc: desc,
      ship: ship.substring(0, 300),
      region: region,
      categoryRaw: categoryRaw
    };
  })()`);

  return raw;
}
