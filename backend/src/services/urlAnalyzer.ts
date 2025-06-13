// backend/src/services/urlAnalyzer.ts
// 🔗 URL analysis with two-step verification process

import { AnalysisResult, WebContent, SearchResult } from '../types/interfaces';
import { searchGoogleAPI, filterTrustedUrls, extractKeywordsFromURL } from './googleSearch';
import { fetchWebContent } from './webScraper';
import { 
  analyzeFirstStepContent, 
  finalTwoStepAnalysis, 
  analyzeURLWithoutSearch 
} from './geminiAI';

/**
 * Main URL analysis function using two-step process
 * Step 1: Search based on URL keywords
 * Step 2: Search based on extracted content topics
 */
export async function analyzeURL(url: string, originalMessage: string): Promise<AnalysisResult> {
  console.log("🔗 Starting 2-step process for URL:", url);
  
  // STEP 1: Extract keywords from URL for initial search
  const urlPath = decodeURIComponent(url);
  const urlKeywords = extractKeywordsFromURL(urlPath);
  console.log("🔍 Keywords from URL:", urlKeywords);
  
  // Check if Google Search API is available
  if (!process.env.GOOGLE_SEARCH_API_KEY || !process.env.GOOGLE_SEARCH_ENGINE_ID) {
    console.log("⚠️ No Google API - cannot perform 2-step process");
    return await analyzeURLWithoutSearch(url, urlKeywords);
  }
  
  // STEP 2: First search based on URL keywords
  console.log("🔍 STEP 1: Search based on URL keywords");
  
  const firstQueries = [
    urlKeywords,
    `"${urlKeywords}"`,
    `${urlKeywords} tin tức`,
    `${urlKeywords} news`
  ].filter(query => query && query.trim().length > 3);
  
  let firstSearchResults: SearchResult[] = [];
  let hasQuotaError = false;
  
  // Perform first search with multiple queries
  for (const query of firstQueries.slice(0, 3)) {
    try {
      const searchResults = await searchGoogleAPI(query, 6);
      firstSearchResults = firstSearchResults.concat(searchResults);
      await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
    } catch (error) {
      console.log("❌ Search error step 1:", (error as Error).message);
      
      if ((error as Error).message && (error as Error).message.includes('Quota exceeded')) {
        hasQuotaError = true;
        break;
      }
    }
  }
  
  // If quota exceeded, fallback to AI-only analysis
  if (hasQuotaError) {
    console.log("⚠️ Google Search API quota exceeded - switching to AI analysis");
    return await analyzeURLWithoutSearch(url, urlKeywords);
  }
  
  // Process first search results
  const uniqueFirstResults = firstSearchResults.filter((result, index, self) => 
    index === self.findIndex(r => r.link === result.link)
  );
  const trustedFirstResults = filterTrustedUrls(uniqueFirstResults);
  console.log(`✅ Search step 1: found ${trustedFirstResults.length} sources`);
  
  // STEP 3: Fetch content from first search results
  console.log("🌐 STEP 2: Fetch content from step 1 search");
  const firstFetchPromises = trustedFirstResults.slice(0, 5).map(result => 
    fetchWebContent(result.link)
  );
  
  const firstContents = await Promise.all(firstFetchPromises);
  const successfulFirstContents = firstContents.filter(content => content.success);
  console.log(`✅ Fetch step 1: successful ${successfulFirstContents.length} sources`);
  
  // If no content was successfully fetched, fallback to AI analysis
  if (successfulFirstContents.length === 0) {
    console.log("⚠️ No content fetched - switching to AI analysis");
    return await analyzeURLWithoutSearch(url, urlKeywords);
  }
  
  // STEP 4: Analyze first step content to get main title and keywords
  console.log("🤖 STEP 3: Analyze content to get main title and keywords");
  const analysisResult = await analyzeFirstStepContent(url, urlKeywords, successfulFirstContents);
  
  if (!analysisResult || !analysisResult.mainTitle || !analysisResult.keyTopics) {
    // If content analysis failed, return simplified analysis
    return await createSimplifiedAnalysis(url, urlKeywords, successfulFirstContents);
  }
  
  console.log("📰 Main title:", analysisResult.mainTitle);
  console.log("🎯 Key topics:", analysisResult.keyTopics);
  
  // STEP 5: Second search based on analyzed title and keywords
  console.log("🔍 STEP 4: Second search based on main title and keywords");
  
  const secondQueries = [
    analysisResult.mainTitle,
    `"${analysisResult.mainTitle}"`,
    analysisResult.keyTopics.join(' '),
    `${analysisResult.mainTitle} fact check`,
    `${analysisResult.keyTopics.join(' ')} xác minh`,
    `${analysisResult.mainTitle} tin tức`
  ].filter(query => query && query.trim().length > 3);
  
  let secondSearchResults: SearchResult[] = [];
  
  // Perform second search
  for (const query of secondQueries.slice(0, 5)) {
    try {
      const searchResults = await searchGoogleAPI(query, 6);
      // Filter out URLs already found in first search
      const newResults = searchResults.filter(result => 
        !firstSearchResults.some(first => first.link === result.link)
      );
      secondSearchResults = secondSearchResults.concat(newResults);
      await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
    } catch (error) {
      console.log("❌ Search error step 2:", (error as Error).message);
      if ((error as Error).message && (error as Error).message.includes('Quota exceeded')) {
        console.log("⚠️ Quota exceeded in step 2 - using step 1 data");
        break;
      }
    }
  }
  
  // Process second search results
  const uniqueSecondResults = secondSearchResults.filter((result, index, self) => 
    index === self.findIndex(r => r.link === result.link)
  );
  const trustedSecondResults = filterTrustedUrls(uniqueSecondResults);
  console.log(`✅ Search step 2: found ${trustedSecondResults.length} new sources`);
  
  // STEP 6: Fetch content from second search results (if any)
  let successfulSecondContents: WebContent[] = [];
  
  if (trustedSecondResults.length > 0) {
    console.log("🌐 STEP 5: Fetch content from step 2 search");
    const secondFetchPromises = trustedSecondResults.slice(0, 5).map(result => 
      fetchWebContent(result.link)
    );
    
    const secondContents = await Promise.all(secondFetchPromises);
    successfulSecondContents = secondContents.filter(content => content.success);
    console.log(`✅ Fetch step 2: successful ${successfulSecondContents.length} sources`);
  }
  
  // STEP 7: Final comprehensive analysis
  console.log("🎯 STEP 6: Final analysis with complete information");
  const finalResult = await finalTwoStepAnalysis(
    url, 
    urlKeywords, 
    analysisResult, 
    successfulFirstContents, 
    successfulSecondContents,
    [...firstQueries, ...secondQueries]
  );
  
  return finalResult || await createSimplifiedAnalysis(
    url, 
    urlKeywords, 
    [...successfulFirstContents, ...successfulSecondContents]
  );
}

/**
 * Create simplified analysis when full two-step process fails
 */
async function createSimplifiedAnalysis(url: string, urlKeywords: string, contents: WebContent[]): Promise<AnalysisResult> {
  return {
    isFakeNews: false,
    confidence: 50,
    reason: `Simplified analysis for ${url} with ${contents.length} sources`,
    indicators: ["Basic analysis - need more comprehensive verification"],
    recommendation: "Requires additional verification from multiple trusted sources",
    twoStepProcess: false,
    sourcesAnalyzed: contents.length,
    originalUrl: url,
    webEvidenceUsed: contents.length > 0,
    limitedAnalysis: true,
    reason_limited: "Two-step process could not complete fully"
  };
}