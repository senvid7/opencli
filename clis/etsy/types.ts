/**
 * Etsy adapter type definitions
 */

export interface EtsyProductBasic {
  pid: string;
  title: string;
  shop: string;
  price: string;
  signals: string;
  origin: string;
  material: string;
  imgs: string[];
  url: string;
}

export interface EtsyReview {
  content_raw: string;
  date_raw: string;
  rating_raw: string;
  selection_reason: string;
}

export interface EtsyProductDetail {
  pid: string;
  title: string;
  shop: string;
  price: string;
  signals: string;
  origin: string;
  material: string;
  image_urls_raw: string[];
  review_count_raw: string;
  shop_stats_raw: string;
  category_raw: string;
  reviews: EtsyReview[];
  description: string;
  shipping: string;
  region: string;
  url: string;
  /** Table-only summary columns */
  imgs_count?: string;
  reviews_count?: string;
}

export interface EtsySearchItem {
  pid: string;
  title: string;
  price: string;
  shop: string;
  thumbnail: string;
  url: string;
}

export interface EtsyImageResult {
  file: string;
  url: string;
  size_kb: string;
}
