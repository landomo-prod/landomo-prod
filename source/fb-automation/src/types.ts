export interface MarketingPost {
  property_id: string;
  title: string;
  price: number;
  old_price?: number;
  currency: string;
  city: string;
  region?: string;
  category: 'apartment' | 'house' | 'land' | 'commercial';
  transaction_type?: 'sale' | 'rent';
  sqm?: number;
  disposition?: string;
  images: string[];
  source_url: string;
  event_type: 'new_listing' | 'price_drop' | 'weekly_roundup';
}

export interface GeneratedContent {
  postText: string;      // Full post with CTA (no link)
  commentText: string;   // Comment variant with property link
  fallbackText: string;  // Post text with link embedded (fallback if comment fails)
}

export interface PublishResult {
  success: boolean;
  post_id?: string;
  error?: string;
  screenshot_path?: string;
}

export interface MarketingJobData {
  rule_id: string;
  post: MarketingPost;
  target_type: 'page' | 'group';
  target_id: string;
}
