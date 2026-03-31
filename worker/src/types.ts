// PixSnap Worker - Type definitions

export interface Env {
  DB: D1Database;
  IMAGES_BUCKET: R2Bucket;
  API_TOKEN: string;
  ALLOWED_ORIGINS: string;
}

export interface ImageRecord {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  width: number | null;
  height: number | null;
  source_url: string;
  page_title: string;
  r2_key: string;
  tags: string;
  capture_mode: string;
  created_at: string;
}

export interface ImageListResponse {
  images: ImageRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface TagCount {
  name: string;
  count: number;
}
