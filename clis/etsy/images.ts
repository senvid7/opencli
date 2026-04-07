import { cli, Strategy } from '@jackwener/opencli/registry';
import type { IPage } from '@jackwener/opencli/types';
import { EmptyResultError, CommandExecutionError } from '@jackwener/opencli/errors';
import { waitForContent, extractBasicInfo } from './_shared/helpers.js';
import type { EtsyImageResult } from './types.js';
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';

cli({
  site: 'etsy',
  name: 'images',
  description: '下载 Etsy 商品图片到本地',
  domain: 'www.etsy.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'pid', required: true, help: 'Etsy 商品 ID' },
    { name: 'outdir', default: './images', help: '输出目录' },
    { name: 'max', type: 'int', default: 5, help: '最大下载数量' },
    { name: 'size', default: '794xN', help: '图片尺寸 (794xN / 340x270 / 300x300 / full)' },
  ],
  columns: ['file', 'url', 'size_kb'],

  func: async (page: IPage, kwargs) => {
    const pid = String(kwargs.pid).replace(/^https?:\/\/.*?\/listing\//, '').split(/[/?#]/)[0];
    const outdir = String(kwargs.outdir);
    const max = Number(kwargs.max) || 5;
    const size = String(kwargs.size);

    // Ensure output directory exists
    if (!existsSync(outdir)) {
      mkdirSync(outdir, { recursive: true });
    }

    // Navigate to product page
    const url = `https://www.etsy.com/listing/${pid}`;
    await page.goto(url);
    await waitForContent(page, 6000);

    // Get image URLs from product page
    const basic = await extractBasicInfo(page);
    if (!basic.imgs || basic.imgs.length === 0) {
      throw new EmptyResultError('etsy images', `No images found for PID ${pid}. The listing may not exist.`);
    }

    const urls = basic.imgs.slice(0, max);
    const results: EtsyImageResult[] = [];

    // Download images via curl (Etsy CDN has no anti-scraping)
    for (let i = 0; i < urls.length; i++) {
      let imgUrl = urls[i];

      // Replace size in URL
      if (size !== 'full') {
        imgUrl = imgUrl.replace(/\/\d+x\d+\./, '/' + size + '.');
      }

      const filename = `${pid}_${String(i + 1).padStart(2, '0')}.jpg`;
      const filepath = `${outdir}/${filename}`;

      try {
        execSync(`curl -sL -o "${filepath}" "${imgUrl}"`, { timeout: 30000 });

        // Check file size
        const stats = execSync(`stat -c%s "${filepath}" 2>/dev/null || echo 0`).toString().trim();
        const sizeKb = (Number(stats) / 1024).toFixed(1);

        results.push({ file: filepath, url: imgUrl, size_kb: sizeKb });
      } catch (_e: unknown) {
        throw new CommandExecutionError(`Failed to download image ${i + 1}: ${imgUrl}`, 'Check network connectivity or try a smaller --size.');
      }

      // Rate limit: 1-2s between downloads
      await new Promise<void>((r) => setTimeout(r, 1500));
    }

    return results;
  },
});
