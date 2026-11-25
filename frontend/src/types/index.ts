export type ContentType = 'definition' | 'formula' | 'code' | 'example' | 'summary' | 'narrative';

export type FeedbackAction = 'replay' | 'slow_down' | 'too_complex' | 'speed_up' | 'bookmark';

export interface Segment {
  segment_id: string;
  sequence_order: number;
  text: string;
  content_type: ContentType;
  complexity_score: number;
  word_count: number;
  generated_ssml: string;
}

export interface DocumentInfo {
  doc_id: string;
  user_id: string;
  title: string;
  segment_count: number;
  upload_timestamp: string;
}

export interface DocumentResponse {
  document: DocumentInfo;
  segments: Segment[];
  stats: {
    segment_count: number;
    content_types: Record<string, number>;
    avg_complexity: number;
    max_segment_words: number;
  };
}

export interface Voice {
  id: string;
  name: string;
  locale: string;
  gender: string;
}

export interface UserProfile {
  user_id: string;
  preferred_voice: string;
  base_speed: number;
  prosody_offset: number;
  high_contrast: number;
  large_text: number;
}

export interface Bookmark {
  segment_id: string;
  doc_id: string;
  title: string;
  sequence_order: number;
  text: string;
  content_type: ContentType;
}

export interface Analytics {
  actions: Record<string, number>;
  prosody_offset: number;
  base_speed: number;
}
