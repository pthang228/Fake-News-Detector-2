// backend/src/types/interfaces.ts
// 📋 All type definitions for the fake news detection system

export interface WebContent {
  url: string;
  content: string;
  title: string;
  success: boolean;
  length: number;
  note?: string;
  error?: string;
}

export interface SearchResult {
  title: string;
  snippet: string;
  link: string;
  displayLink: string;
  formattedUrl?: string;
}

export interface AnalysisResult {
  isFakeNews: boolean;
  confidence: number;
  reason: string;
  indicators: string[];
  recommendation: string;
  webEvidenceUsed: boolean;
  sourcesAnalyzed: number;
  twoStepProcess?: boolean;
  originalUrl?: string;
  searchQueries?: string[];
  identifiedTitle?: string;
  keyTopics?: string[];
  limitedAnalysis?: boolean;
  reason_limited?: string;
  error?: string;
  twoStepFindings?: string;
  firstStepAnalysis?: string;
  secondStepAnalysis?: string;
  consistencyCheck?: string;
  mainTopicVerification?: string;
  sourceDistribution?: string;
  domainAnalysis?: string;
  topicAnalysis?: string;
}

export interface FirstStepAnalysisResult {
  mainTitle: string;
  keyTopics: string[];
  coreContent: string;
  mainEntities: string[];
  eventLocation: string;
  eventType: string;
  urgencyLevel: string;
}

export interface WebAnalysisResult {
  detailedAnalysis: string;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  sourceAnalysis: { [key: string]: string };
  contextualFactors: string[];
  nuancesFound: string[];
  crossReferenceFindings: string;
  contentBasedConclusion: string;
}

export interface Statistics {
  analysisMode?: string;
  originalUrl?: string;
  sourcesAnalyzed?: number;
  identifiedTitle?: string;
  keyTopics?: string[];
  searchQueries?: string[];
  twoStepEnabled?: boolean;
  note?: string;
  totalSitesFound?: number;
  sitesAnalyzed?: number;
  totalContentLength?: number;
  sourceDomains?: string[];
}

export interface ApiResponse {
  success: boolean;
  analysis?: AnalysisResult;
  originalText?: string;
  twoStepProcess?: boolean;
  originalUrl?: string;
  statistics?: Statistics;
  webContents?: Array<{
    url: string;
    title: string;
    length: number;
    preview: string;
  }>;
  error?: string;
  details?: string;
  url?: string;
  isUrl?: boolean;
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
}