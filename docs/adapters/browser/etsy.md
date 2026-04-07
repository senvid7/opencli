# Etsy

**Mode**: 🔐 Browser · **Domain**: `www.etsy.com`

## Commands

| Command | Description |
|---------|-------------|
| `opencli etsy search` | 搜索 Etsy 商品，返回列表（PID/标题/价格/缩略图/店铺） |
| `opencli etsy product` | 采集 Etsy 商品完整数据（标题/价格/图片/销量/评论/描述/物流/店铺） |
| `opencli etsy images` | 下载 Etsy 商品图片到本地 |

## Usage Examples

```bash
# Search for jade pendants
opencli etsy search --query "jade pendant" --limit 20 --scroll 5

# Get full product data by PID
opencli etsy product --pid 1064621498

# Also accepts full URLs
opencli etsy product --pid https://www.etsy.com/listing/1064621498

# Download product images
opencli etsy images --pid 1064621498 --outdir ./images --max 5 --size 794xN

# JSON output for programmatic use
opencli etsy product --pid 1064621498 -f json

# Table view (default)
opencli etsy search --query "jade necklace" --limit 10

# Verbose mode (debug extraction)
opencli etsy product --pid 1064621498 -v
```

## Output Formats

Use `-f` / `--format` to control output: `table` (default), `json`, `yaml`, `md`, `csv`.

### product — Fields

| Field | Description |
|-------|-------------|
| `pid` | Listing ID |
| `title` | Product title |
| `price` | Price (e.g. `$23.40 (Orig $23.50)`) |
| `shop` | Shop name |
| `signals` | Sales signals (Bestseller, Star Seller, N favorites) |
| `origin` | Ship-from location |
| `material` | Materials listed |
| `image_urls_raw` | Array of image CDN URLs |
| `review_count_raw` | Average rating + review count (e.g. `4.9/5 stars, 42 reviews`) |
| `shop_stats_raw` | Shop stats (e.g. `Rating:4.8 Reviews:3.5k Sales:14.9k YearsOnEtsy:4`) |
| `reviews` | Array of review objects (rating, date, content) |
| `description` | Full product description |
| `shipping` | Shipping info and policies |
| `region` | User region (from cookie) |
| `category_raw` | Breadcrumb category path |

### search — Fields

| Field | Description |
|-------|-------------|
| `pid` | Listing ID |
| `title` | Product title |
| `price` | Price value |
| `shop` | Shop name |
| `thumbnail` | Image thumbnail URL |

### images — Fields

| Field | Description |
|-------|-------------|
| `file` | Local file path |
| `url` | Source CDN URL |
| `size_kb` | Downloaded file size |

## Arguments Reference

### `etsy search`

| Arg | Required | Default | Description |
|-----|----------|---------|-------------|
| `--query` | ✅ | — | Search keywords |
| `--limit` | — | 20 | Max results to return |
| `--scroll` | — | 3 | Number of scroll-to-load iterations |

### `etsy product`

| Arg | Required | Default | Description |
|-----|----------|---------|-------------|
| `--pid` | ✅ | — | Listing ID or full URL |

### `etsy images`

| Arg | Required | Default | Description |
|-----|----------|---------|-------------|
| `--pid` | ✅ | — | Listing ID or full URL |
| `--outdir` | — | `./images` | Output directory |
| `--max` | — | 5 | Max images to download |
| `--size` | — | `794xN` | Image size: `794xN`, `340x270`, `300x300`, `full` |

## Prerequisites

- Chrome running and **logged into** Etsy
- [Browser Bridge extension](/guide/browser-bridge) installed
- Daemon running: `opencli doctor`

## Implementation Notes

- **Strategy**: Cookie-based — reuses Chrome session cookies
- **Anti-scraping**: Does NOT open new tabs (prevents captcha). Uses `page.goto()` within the same tab.
- **Rate limiting**: Images download has 1.5s delay between requests
- **Image CDN**: `i.etsystatic.com` has no anti-scraping; direct `curl` download is safe
- **Price format**: Supports `$`, `¥`, `£` with sale/original price detection
- **Shop stats regex**: Handles Etsy's `4.8 | (3.5k) | · | 14.9k sales | · | 4 years on Etsy` format
