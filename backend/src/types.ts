// Types
export interface WebContent {
  url: string;
  content: string;
  title: string;
  success: boolean;
  length: number;
  error?: string;
  note?: string;
}

export interface SearchResult {
  title: string;
  snippet: string;
  link: string;
  displayLink: string;
  formattedUrl: string;
}

export interface AnalysisResult {
  isFakeNews: boolean;
  confidence: number;
  reason: string;
  indicators: string[];
  recommendation: string;
  webEvidenceUsed?: boolean;
  sourcesAnalyzed?: number;
  twoStepProcess?: boolean;
  originalUrl?: string;
  searchQueries?: string[];
  identifiedTitle?: string;
  keyTopics?: string[];
  limitedAnalysis?: boolean;
  error?: string;
}

export interface FirstStepAnalysis {
  mainTitle: string;
  keyTopics: string[];
  coreContent: string;
  mainEntities: string[];
  eventLocation: string;
  eventType: string;
  urgencyLevel: string;
}

export interface HistoryEntry {
  id: number;
  text: string;
  result: AnalysisResult;
  sourcesAnalyzed: number;
  analysisType: string;
  timestamp: string;
  originalUrl?: string;
  identifiedTitle?: string;
  keyTopics?: string[];
  twoStepProcess?: boolean;
  userNote?: string;
  noteUpdatedAt?: string;
}