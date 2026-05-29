export interface User {
  id: string
  email: string
  username: string
  display_name: string | null
  role: 'admin' | 'member'
  locale: string
  is_active: boolean
  is_superuser: boolean
  is_verified: boolean
  created_at: string
  last_login_at: string | null
}

export interface Invite {
  id: string
  code: string
  email_hint: string | null
  expires_at: string
  used_at: string | null
  used_by: string | null
  created_at: string
}

export interface MediaSearchResult {
  external_source: string
  external_id: string
  media_type: string
  title: string
  // Local-cache hits omit `slug` (we serialize the trimmed admin shape
  // from the DB row); external hits always have it.
  slug?: string
  synopsis: string | null
  cover_url: string | null
  release_year: number | null
  // Local hits don't carry the full normalized shape — these are
  // populated only on external (IGDB/TMDB/BGG) responses.
  genres?: string[]
  rating_external?: number | null
  igdb_id?: number
  platforms?: string[]
  developers?: string[]
  // Curation/cache metadata (SPEC §12h).
  from_cache?: boolean
  media_id?: string
  is_curated?: boolean
}

export interface CatalogItem {
  id: string
  user_id: string
  media_id: string
  status: 'not_started' | 'in_progress' | 'paused' | 'completed' | 'dropped'
  user_rating: number | null
  progress_text: string | null
  pinned: boolean
  backlog_priority: number
  tags: string[]
  current_next_steps: string[]
  last_session_at: string | null
  source: string | null
  personal_notes: string | null
  parallel_notes: string | null
  review_text: string | null
  review_has_spoilers: boolean
  walkthrough_url: string | null
  created_at: string
  updated_at: string
  // Joined media fields
  media_title: string | null
  media_cover_url: string | null
  media_type: string | null
}

export interface DashboardStats {
  total_items: number
  sessions_this_week: number
  total_duration_minutes: number
  streak_days: number
  sessions_by_day: { date: string; count: number; duration_minutes: number }[]
  duration_by_type: Record<string, number>
  by_status: Record<string, number>
  by_type: Record<string, number>
}

export interface MediaSummary {
  id?: string
  summary_text: string | null
  generated_at: string | null
  sessions_covered: number
  last_session_id?: string | null
  model_used?: string | null
  input_tokens?: number
  output_tokens?: number
  cost_usd?: number
}

export interface MediaSummaryHistory {
  items: MediaSummary[]
}

export interface SessionRead {
  id: string
  user_catalog_id: string
  user_id: string
  started_at: string
  duration_minutes: number | null
  raw_input: string
  enriched_text: string | null
  next_steps: string[]
  tags: string[]
  is_enriched: boolean
  enrichment_model: string | null
  enrichment_input_tokens: number | null
  enrichment_output_tokens: number | null
  enrichment_cost_usd: number | null
  created_at: string
  updated_at: string
}

export interface SessionCursorPage {
  items: SessionRead[]
  next_cursor: string | null
}

export interface MediaItem {
  id: string
  title: string
  media_type: string
  cover_url: string | null
  backdrop_url: string | null
  synopsis: string | null
  release_year: number | null
  genres: string[]
  rating_external: number | null
}

export interface SessionAttachment {
  id: string
  session_log_id: string
  original_filename: string | null
  mime_type: string
  size_bytes: number
  created_at: string
}

export interface ApiError {
  detail: string | { code: string; detail: string; context: Record<string, unknown> }
}

export interface BrowseItem {
  id: string
  media_type: string
  title: string
  cover_url: string | null
  release_year: number | null
  genres: string[]
  rating_external: number | null
  catalog_count: number
  catalog_status: 'not_started' | 'in_progress' | 'paused' | 'completed' | 'dropped' | null
  catalog_id: string | null
}

export interface BrowseResponse {
  items: BrowseItem[]
  total: number
  page: number
  pages: number
}
