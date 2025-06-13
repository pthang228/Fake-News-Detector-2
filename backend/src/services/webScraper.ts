// backend/src/services/webScraper.ts
// 🌐 Web scraping and content extraction utilities

import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { WebContent } from '../types/interfaces';

// User-Agent configurations to avoid being blocked
const USER_AGENTS: string[] = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
];

/**
 * Get random User-Agent to avoid detection
 */
export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Extract clean text content from HTML
 * Removes ads, navigation, and other non-content elements
 */
export function extractTextFromHTML(html: string): string {
  try {
    const $ = cheerio.load(html);
    
    // Remove unnecessary elements
    $('script, style, nav, footer, header, aside, .advertisement, .ads, .social-share, .comments, .sidebar').remove();
    
    let mainContent = '';
    
    // Try to find main content using common selectors
    const contentSelectors: string[] = [
      'article',
      '[role="main"]', 
      '.content',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.article-body',
      '.story-body',
      '.content-body',
      'main',
      '.main-content',
      '.post-body',
      '.article-text',
      '.story-content',
      '#content',
      '.news-content'
    ];
    
    // Find the best content element
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const elementText = element.text().trim();
        if (elementText.length > 100) {
          mainContent = elementText;
          break;
        }
      }
    }
    
    // Fallback to body text if no main content found
    if (!mainContent || mainContent.length < 100) {
      const bodyText = $('body').text().trim();
      if (bodyText.length > 0) {
        mainContent = bodyText;
      }
    }
    
    // Final fallback - get all text
    if (!mainContent || mainContent.length < 50) {
      mainContent = $.text().trim();
    }
    
    // Clean up the text
    if (mainContent) {
      mainContent = mainContent
        .replace(/\s+/g, ' ')        // Multiple spaces → single space
        .replace(/\n+/g, '\n')       // Multiple newlines → single newline
        .replace(/\t+/g, ' ')        // Tabs → spaces
        .trim();
    }
    
    return mainContent || '';
    
  } catch (error) {
    console.error("❌ Error extracting text from HTML:", (error as Error).message);
    return '';
  }
}

/**
 * Extract title from HTML document
 */
export function extractTitleFromHTML(html: string): string {
  try {
    const $ = cheerio.load(html);
    return $('title').text().trim() || $('h1').first().text().trim() || '';
  } catch (error) {
    return '';
  }
}

/**
 * Fetch and extract content from a web URL
 * Includes retry logic and fallback content extraction
 */
export async function fetchWebContent(url: string, maxRetries: number = 1): Promise<WebContent> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🌐 Fetching content from: ${url} (attempt ${attempt})`);
      
      const response: AxiosResponse<string> = await axios.get(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        timeout: 20000,
        maxRedirects: 5,
        validateStatus: (status) => status < 400
      });
      
      if (response.data && typeof response.data === 'string' && response.data.length > 0) {
        const textContent = extractTextFromHTML(response.data);
        const title = extractTitleFromHTML(response.data);
        
        // If we got good content, return it
        if (textContent && textContent.length > 50) {
          console.log(`✅ Fetch successful: ${textContent.length} chars from ${url}`);
          return {
            url: url,
            content: textContent,
            title: title || 'No title',
            success: true,
            length: textContent.length
          };
        } else {
          // Try fallback content extraction from meta tags
          console.log(`⚠️ Content too short: ${textContent?.length || 0} chars from ${url}`);
          
          const $ = cheerio.load(response.data);
          const metaDescription = $('meta[name="description"]').attr('content') || '';
          const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
          const ogDescription = $('meta[property="og:description"]').attr('content') || '';
          const h1Text = $('h1').text().trim();
          const h2Text = $('h2').first().text().trim();
          
          const fallbackContent = [title, h1Text, h2Text, metaDescription, ogDescription, metaKeywords]
            .filter((text): text is string => text !== null && text !== undefined && text.length > 0)
            .join('\n\n');
          
          if (fallbackContent.length > 30) {
            console.log(`✅ Using fallback content: ${fallbackContent.length} chars from ${url}`);
            return {
              url: url,
              content: fallbackContent,
              title: title || h1Text || 'No title',
              success: true,
              length: fallbackContent.length,
              note: 'Using meta data - could not extract main content'
            };
          }
        }
      }
      
      throw new Error(`Cannot extract useful content from ${url}`);
      
    } catch (error) {
      console.log(`❌ Attempt ${attempt} failed for ${url}: ${(error as Error).message}`);
      
      if (attempt === maxRetries) {
        return {
          url: url,
          content: '',
          title: '',
          success: false,
          length: 0,
          error: (error as Error).message
        };
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }

  // This should never be reached, but TypeScript requires it
  return {
    url: url,
    content: '',
    title: '',
    success: false,
    length: 0,
    error: 'Max retries exceeded'
  };
}