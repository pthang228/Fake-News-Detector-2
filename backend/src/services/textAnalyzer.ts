// backend/src/services/textAnalyzer.ts
// 📝 Text analysis with web search integration

import { ApiResponse, WebContent, SearchResult, WebAnalysisResult } from '../types/interfaces';
import { searchGoogleAPI, filterTrustedUrls } from './googleSearch';
import { fetchWebContent } from './webScraper';
import { analyzeTextWithAI, analyzeTextWithWebEvidence, analyzeWebContent } from './geminiAI';

/**
 * Main text analysis function with optional web search
 * Combines AI analysis with web evidence when available
 */
export async function analyzeTextWithWebSearch(message: string): Promise<ApiResponse> {
  console.log("📝 Starting text analysis:", message.substring(0, 100) + "...");

  // Check if Google Search API is available
  const hasGoogleAPI = !!(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID);
  
  let allSearchResults: SearchResult[] = [];
  let webContents: WebContent[] = [];
  let webAnalysis: WebAnalysisResult | null = null;
  
  if (hasGoogleAPI) {
    console.log("🔍 Step 1: Searching for information...");
    
    // Create search queries based on the input text
    const searchQueries = [
      message.substring(0, 200),                    // First 200 chars
      `"${message.substring(0, 100)}"`,            // Exact phrase search
      `${message.substring(0, 100)} fact check`,   // Fact-check search
      `${message.substring(0, 100)} tin tức`,      // Vietnamese news search
      `${message.substring(0, 100)} sự thật`       // Vietnamese truth search
    ];

    // Perform searches with multiple queries
    for (const query of searchQueries.slice(0, 4)) {
      try {
        const searchResults = await searchGoogleAPI(query, 8);
        allSearchResults = allSearchResults.concat(searchResults);
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
      } catch (error) {
        console.log("❌ Search error:", (error as Error).message);
        // Continue with other queries even if one fails
      }
    }

    // Remove duplicates and filter trusted URLs
    const uniqueResults = allSearchResults.filter((result, index, self) => 
      index === self.findIndex(r => r.link === result.link)
    );
    
    const trustedResults = filterTrustedUrls(uniqueResults);
    console.log(`✅ Found ${trustedResults.length} trusted results`);

    // STEP 2: Fetch content from web pages
    if (trustedResults.length > 0) {
      console.log("🌐 Step 2: Loading content from web pages...");
      const maxSitesToFetch = 8;
      const fetchPromises = trustedResults.slice(0, maxSitesToFetch).map(result => 
        fetchWebContent(result.link)
      );

      webContents = await Promise.all(fetchPromises);
      const successfulFetches = webContents.filter(content => content.success);
      
      console.log(`✅ Successfully loaded ${successfulFetches.length}/${maxSitesToFetch} web pages`);

      // STEP 3: Analyze web content if available
      if (successfulFetches.length > 0) {
        console.log("🔍 Step 3: Detailed web content analysis...");
        webAnalysis = await analyzeWebContent(message, webContents);
      }
    }
  } else {
    console.log("⚠️ Google Search API not available - using AI-only analysis");
  }

  // STEP 4: Main analysis with Gemini AI
  console.log("🤖 Step 4: Main analysis with Gemini AI...");
  
  let analysisResult;
  
  if (webAnalysis && webContents.filter(c => c.success).length > 0) {
    // Enhanced analysis with web evidence
    analysisResult = await analyzeTextWithWebEvidence(message, webContents, webAnalysis);
  } else {
    // Basic AI analysis without web evidence
    analysisResult = await analyzeTextWithAI(message);
  }

  console.log("✅ Analysis completed");

  // Prepare response with complete data
  const responseData: ApiResponse = {
    success: true,
    analysis: analysisResult,
    originalText: message
  };

  // Add web information if available
  if (webContents.length > 0) {
    responseData.webContents = webContents
      .filter(content => content.success)
      .map(content => ({
        url: content.url,
        title: content.title,
        length: content.length,
        preview: content.content.substring(0, 300) + "..."
      }));
    
    responseData.statistics = {
      analysisMode: hasGoogleAPI ? "Text Analysis" : "Basic AI Analysis",
      totalSitesFound: allSearchResults.length,
      sitesAnalyzed: webContents.filter(c => c.success).length,
      totalContentLength: webContents.filter(c => c.success).reduce((sum, content) => sum + content.length, 0),
      sourceDomains: [...new Set(webContents.filter(c => c.success).map(content => content.url.split('/')[2]))]
    };
  } else {
    responseData.statistics = {
      analysisMode: hasGoogleAPI ? "AI Analysis (No Web Results)" : "Basic AI Analysis",
      note: hasGoogleAPI ? "No relevant web sources found" : "Google Search API not configured"
    };
  }

  return responseData;
}

/**
 * Simple text analysis without web search
 * Used as fallback when web search is not available
 */
export async function analyzeTextOnly(message: string): Promise<ApiResponse> {
  console.log("📝 Simple text analysis without web search");
  
  const analysisResult = await analyzeTextWithAI(message);
  
  return {
    success: true,
    analysis: analysisResult,
    originalText: message,
    statistics: {
      analysisMode: "Basic AI Analysis Only",
      note: "No web search performed"
    }
  };
}