// backend/src/services/googleSearch.ts
// 🔍 Google Custom Search API integration and URL filtering

import axios from 'axios';
import { SearchResult } from '../types/interfaces';

/**
 * Search using Google Custom Search API
 * Returns array of search results with title, snippet, and URL
 */
export async function searchGoogleAPI(query: string, maxResults: number = 10): Promise<SearchResult[]> {
  try {
    const searchUrl = 'https://www.googleapis.com/customsearch/v1';
    
    const params = {
      key: process.env.GOOGLE_SEARCH_API_KEY,
      cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
      q: query,
      num: Math.min(maxResults, 10),
      safe: 'medium',
      lr: 'lang_vi|lang_en'  // Vietnamese and English results
    };

    const response = await axios.get(searchUrl, { params });
    
    if (response.data.items) {
      return response.data.items.map((item: any) => ({
        title: item.title,
        snippet: item.snippet,
        link: item.link,
        displayLink: item.displayLink,
        formattedUrl: item.formattedUrl
      }));
    }
    
    return [];
  } catch (error) {
    console.error('❌ Error calling Google Search API:', (error as any).response?.data || (error as Error).message);
    return [];
  }
}

/**
 * Filter search results to prioritize trusted news sources
 * Removes low-quality domains and sorts by trustworthiness
 */
export function filterTrustedUrls(searchResults: SearchResult[]): SearchResult[] {
  // Trusted news domains - prioritized in results
  const trustedDomains: string[] = [
    'wikipedia.org',
    'gov.vn',           // Vietnamese government sites
    'edu.vn',           // Vietnamese education sites
    'bbc.com',
    'cnn.com',
    'reuters.com',
    'ap.org',
    'vnexpress.net',    // Vietnamese news
    'tuoitre.vn',
    'thanhnien.vn',
    'vietnamnet.vn',
    'dantri.com.vn',
    'vietNamNews.vn',
    'bloomberg.com',
    'wsj.com',
    'nytimes.com',
    'theguardian.com',
    'factcheck.org',    // Fact-checking sites
    'snopes.com',
    'politifact.com'
  ];
  
  // Low-quality domains to filter out
  const lowQualityDomains: string[] = [
    'facebook.com',
    'twitter.com',
    'instagram.com',
    'tiktok.com',
    'youtube.com',
    'reddit.com'
  ];
  
  // Filter out low-quality domains
  const filteredResults = searchResults.filter(result => {
    const domain = result.displayLink.toLowerCase();
    
    // Remove low-quality domains
    if (lowQualityDomains.some(bad => domain.includes(bad))) {
      return false;
    }
    
    return true;
  });
  
  // Sort by trustworthiness (trusted domains first)
  return filteredResults.sort((a, b) => {
    const aTrusted = trustedDomains.some(trusted => a.displayLink.toLowerCase().includes(trusted));
    const bTrusted = trustedDomains.some(trusted => b.displayLink.toLowerCase().includes(trusted));
    
    if (aTrusted && !bTrusted) return -1;  // a comes first
    if (!aTrusted && bTrusted) return 1;   // b comes first
    return 0;  // maintain original order
  });
}

/**
 * Check if a string is a valid URL
 */
export function isValidURL(string: string): boolean {
  try {
    const url = new URL(string.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

/**
 * Extract meaningful keywords from URL path
 * Handles Vietnamese URLs and various URL structures
 */
export function extractKeywordsFromURL(urlPath: string): string {
  try {
    console.log("🔍 Analyzing URL:", urlPath);
    
    // Decode URL first to handle encoded characters
    const decodedPath = decodeURIComponent(urlPath);
    console.log("🔍 Decoded URL:", decodedPath);
    
    // Split URL into parts
    const pathParts = decodedPath.split('/');
    
    // Find the part most likely to contain meaningful content
    let bestKeywords = '';
    let maxScore = 0;
    
    for (const part of pathParts) {
      if (part.length < 5) continue; // Skip too short parts
      
      let score = 0;
      
      // Scoring criteria:
      
      // 1. Contains Vietnamese characters (high value)
      if (/[áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]/i.test(part)) {
        score += 10;
      }
      
      // 2. Has multiple words (separated by hyphens/underscores)
      const wordCount = part.split(/[-_]/).length;
      score += wordCount;
      
      // 3. Reasonable length (not too short, not too long)
      if (part.length > 20 && part.length < 200) {
        score += 5;
      }
      
      // 4. Doesn't contain query parameters
      if (!part.includes('=') && !part.includes('?') && !part.includes('&')) {
        score += 3;
      }
      
      // 5. Not a random ID (all numbers/letters)
      if (!/^[a-zA-Z0-9]{10,}$/.test(part)) {
        score += 2;
      }
      
      console.log(`🔍 Part "${part.substring(0, 50)}..." score: ${score}`);
      
      if (score > maxScore) {
        maxScore = score;
        bestKeywords = part;
      }
    }
    
    if (bestKeywords) {
      // Clean up the best keywords
      let cleanKeywords = bestKeywords
        .replace(/[-_]/g, ' ')                    // Replace hyphens/underscores with spaces
        .replace(/%[0-9A-F]{2}/gi, ' ')          // Remove URL encoding remnants
        .replace(/[^a-zA-Z0-9\sáàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]/gi, ' ')
        .replace(/\s+/g, ' ')                    // Multiple spaces → single space
        .trim();
      
      console.log(`✅ Best keywords: "${cleanKeywords}"`);
      return cleanKeywords;
    }
    
    // Fallback strategies
    const domain = urlPath.split('/')[2] || '';
    const lastPath = pathParts[pathParts.length - 1] || '';
    
    let fallbackKeywords = '';
    
    // Special handling for MSN.com URLs
    if (domain.includes('msn.com')) {
      const categoryIndex = pathParts.findIndex(part => 
        ['lifestyle', 'sports', 'news', 'entertainment', 'health', 'technology'].includes(part)
      );
      
      if (categoryIndex >= 0 && pathParts[categoryIndex + 1]) {
        fallbackKeywords = `${pathParts[categoryIndex]} ${pathParts[categoryIndex + 1]}`;
      }
    }
    
    // General fallback - clean last path segment
    if (!fallbackKeywords) {
      fallbackKeywords = lastPath
        .replace(/[^a-zA-Z0-9\sáàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ-]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    console.log(`🔄 Fallback keywords: "${fallbackKeywords}"`);
    return fallbackKeywords || 'tin tức mới';  // Default fallback
    
  } catch (error) {
    console.error("❌ Error extracting keywords from URL:", error);
    return 'tin tức';  // Safe fallback
  }
}