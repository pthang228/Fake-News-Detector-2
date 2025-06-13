// backend/server.ts
// 🚀 Main server file - clean and focused

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import our modular services
import { analyzeURL } from './urlAnalyzer';
import { analyzeTextWithWebSearch } from './textAnalyzer';
import { isValidURL } from './googleSearch';
import { HistoryEntry, ApiResponse } from '../types/interfaces';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory history storage (consider using database for production)
let analysisHistory: HistoryEntry[] = [];

// 🎯 MAIN ANALYSIS ENDPOINT
app.post("/api/analyze", async (req: Request, res: Response): Promise<void> => {
  try {
    const { message }: { message: string } = req.body;

    // Input validation
    if (!message || message.trim() === "") {
      res.status(400).json({
        error: "Please enter content to analyze"
      });
      return;
    }

    console.log("📝 Starting analysis:", message.substring(0, 100) + "...");

    // Determine analysis type: URL vs Text
    if (isValidURL(message)) {
      console.log("🔗 URL detected - using URL analysis");
      await handleURLAnalysis(message, res);
    } else {
      console.log("📝 Text detected - using text analysis");
      await handleTextAnalysis(message, res);
    }

  } catch (error) {
    console.error("❌ General analysis error:", error);
    res.status(500).json({
      error: "Error occurred during content analysis",
      details: (error as Error).message
    });
  }
});

// 🔗 Handle URL Analysis
async function handleURLAnalysis(url: string, res: Response): Promise<void> {
  try {
    const urlAnalysis = await analyzeURL(url, url);
    
    const responseData: ApiResponse = {
      success: true,
      analysis: urlAnalysis,
      originalText: url,
      twoStepProcess: urlAnalysis.twoStepProcess || false,
      originalUrl: url
    };

    // Add statistics based on analysis type
    if (urlAnalysis.twoStepProcess) {
      responseData.statistics = {
        analysisMode: "Two-Step",
        originalUrl: url,
        sourcesAnalyzed: urlAnalysis.sourcesAnalyzed || 0,
        identifiedTitle: urlAnalysis.identifiedTitle || "Could not identify",
        keyTopics: urlAnalysis.keyTopics || [],
        searchQueries: urlAnalysis.searchQueries || [],
        twoStepEnabled: true
      };
    } else {
      responseData.statistics = {
        analysisMode: urlAnalysis.limitedAnalysis ? "Limited URL Analysis" : "Basic URL Analysis",
        originalUrl: url,
        sourcesAnalyzed: urlAnalysis.sourcesAnalyzed || 0,
        twoStepEnabled: false,
        note: urlAnalysis.reason_limited || "Two-step process not available"
      };
    }

    res.json(responseData);
    
  } catch (error) {
    console.error("❌ Error analyzing URL:", error);
    res.status(500).json({
      error: "Cannot analyze provided URL",
      details: (error as Error).message,
      url: url
    });
  }
}

// 📝 Handle Text Analysis
async function handleTextAnalysis(text: string, res: Response): Promise<void> {
  try {
    const textAnalysisResult = await analyzeTextWithWebSearch(text);
    res.json(textAnalysisResult);
  } catch (error) {
    console.error("❌ Error in text analysis:", error);
    res.status(500).json({
      error: "Error occurred during text analysis",
      details: (error as Error).message
    });
  }
}

// 🧪 TEST ENDPOINT
app.get("/api/test", (req: Request, res: Response): void => {
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasGoogle = !!(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID);
  
  res.json({
    message: "🚀 Fake News Detection API is running!",
    status: "healthy",
    configuration: {
      geminiAI: hasGemini ? "✅ Configured" : "❌ Not configured",
      googleSearch: hasGoogle ? "✅ Configured" : "❌ Not configured"
    },
    features: {
      textAnalysis: "✅ Available",
      urlAnalysis: hasGoogle ? "✅ Full Two-Step Process" : "⚠️ Limited (AI only)",
      webSearch: hasGoogle ? "✅ Enabled" : "❌ Disabled",
      contentFetching: "✅ Enabled",
      factChecking: "✅ Enabled"
    },
    analysisCapabilities: {
      basicAI: "Always available",
      webEvidence: hasGoogle ? "Available with Google API" : "Requires Google API",
      twoStepURL: hasGoogle ? "Available" : "Requires Google API",
      contentExtraction: "Always available"
    },
    timestamp: new Date().toISOString(),
    version: "2.0.0"
  });
});

// 📊 HISTORY MANAGEMENT ENDPOINTS

// Get all history
app.get("/api/history", (req: Request, res: Response): void => {
  res.json({
    success: true,
    history: analysisHistory,
    count: analysisHistory.length
  });
});

// Clear all history
app.delete("/api/history", (req: Request, res: Response): void => {
  try {
    const deletedCount = analysisHistory.length;
    analysisHistory = [];
    res.json({
      success: true,
      message: `Successfully deleted ${deletedCount} history entries`,
      deletedCount: deletedCount
    });
  } catch (error) {
    console.error("❌ Error clearing history:", error);
    res.status(500).json({
      success: false,
      error: "Cannot clear history"
    });
  }
});

// Delete specific history item
app.delete("/api/history/:id", (req: Request, res: Response): void => {
  try {
    const itemId = parseInt(req.params.id);
    
    if (!itemId || isNaN(itemId)) {
      res.status(400).json({
        success: false,
        error: "Invalid ID - must be a number"
      });
      return;
    }
    
    const initialLength = analysisHistory.length;
    analysisHistory = analysisHistory.filter(item => item.id !== itemId);
    
    if (analysisHistory.length === initialLength) {
      res.status(404).json({
        success: false,
        error: "Item with this ID not found"
      });
      return;
    }
    
    res.json({
      success: true,
      message: "Successfully deleted history item",
      deletedId: itemId,
      remainingCount: analysisHistory.length
    });
  } catch (error) {
    console.error("❌ Error deleting history item:", error);
    res.status(500).json({
      success: false,
      error: "Cannot delete history item"
    });
  }
});

// Get history statistics
app.get("/api/history/stats", (req: Request, res: Response): void => {
  try {
    const total = analysisHistory.length;
    
    if (total === 0) {
      res.json({
        success: true,
        stats: {
          total: 0,
          fakeCount: 0,
          realCount: 0,
          urlAnalyses: 0,
          textAnalyses: 0,
          twoStepAnalyses: 0,
          avgConfidence: 0,
          timeStats: {
            today: 0,
            thisWeek: 0,
            thisMonth: 0
          }
        }
      });
      return;
    }
    
    // Calculate statistics
    const fakeCount = analysisHistory.filter(item => item.result.isFakeNews).length;
    const realCount = total - fakeCount;
    const urlAnalyses = analysisHistory.filter(item => item.analysisType.includes('URL')).length;
    const textAnalyses = total - urlAnalyses;
    const twoStepAnalyses = analysisHistory.filter(item => item.twoStepProcess).length;
    
    const avgConfidence = Math.round(
      analysisHistory.reduce((sum, item) => sum + item.result.confidence, 0) / total
    );
    
    // Time-based statistics
    const now = new Date();
    const today = now.toDateString();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const todayCount = analysisHistory.filter(item => 
      new Date(item.timestamp).toDateString() === today
    ).length;
    
    const weekCount = analysisHistory.filter(item => 
      new Date(item.timestamp) >= oneWeekAgo
    ).length;
    
    const monthCount = analysisHistory.filter(item => 
      new Date(item.timestamp) >= oneMonthAgo
    ).length;
    
    res.json({
      success: true,
      stats: {
        total,
        fakeCount,
        realCount,
        urlAnalyses,
        textAnalyses,
        twoStepAnalyses,
        avgConfidence,
        timeStats: {
          today: todayCount,
          thisWeek: weekCount,
          thisMonth: monthCount
        }
      }
    });
  } catch (error) {
    console.error("❌ Error calculating statistics:", error);
    res.status(500).json({
      success: false,
      error: "Cannot calculate statistics"
    });
  }
});

// 📝 HISTORY MIDDLEWARE
// Automatically save successful analyses to history
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST' && req.path === '/api/analyze') {
    const originalJson = res.json;
    res.json = function (data: any) {
      // Save to history if analysis was successful
      if (data.success && data.analysis) {
        try {
          const historyEntry: HistoryEntry = {
            id: Date.now(), // Simple ID based on timestamp
            text: data.originalText,
            result: data.analysis,
            sourcesAnalyzed: data.statistics?.sourcesAnalyzed || 0,
            analysisType: data.twoStepProcess ? 'Two-Step URL Analysis' : 'Text Analysis',
            timestamp: new Date().toISOString()
          };

          // Add URL-specific information if available
          if (data.twoStepProcess) {
            historyEntry.originalUrl = data.originalUrl;
            historyEntry.identifiedTitle = data.analysis.identifiedTitle;
            historyEntry.keyTopics = data.analysis.keyTopics;
            historyEntry.twoStepProcess = true;
          }

          // Add to beginning of history array
          analysisHistory.unshift(historyEntry);

          // Keep only last 100 entries to prevent memory issues
          if (analysisHistory.length > 100) {
            analysisHistory = analysisHistory.slice(0, 100);
          }

          console.log(`📊 Saved to history: ${historyEntry.analysisType} - Total entries: ${analysisHistory.length}`);
        } catch (error) {
          console.error("❌ Error saving to history:", error);
          // Don't fail the request if history saving fails
        }
      }
      
      // Call original json method
      originalJson.call(this, data);
    };
  }
  next();
});

// 🚨 ERROR HANDLING MIDDLEWARE
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('💥 Server error:', err);
  res.status(500).json({ 
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 🔍 404 HANDLER
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    path: req.path,
    method: req.method,
    availableEndpoints: [
      'POST /api/analyze - Main analysis endpoint',
      'GET /api/test - Health check',
      'GET /api/history - Get analysis history',
      'DELETE /api/history - Clear all history',
      'DELETE /api/history/:id - Delete specific history item',
      'GET /api/history/stats - Get history statistics'
    ]
  });
});

// 🚀 START SERVER
app.listen(port, () => {
  console.log('\n🚀 ================================');
  console.log('   FAKE NEWS DETECTION API');
  console.log('🚀 ================================');
  console.log(`✅ Server running at: http://localhost:${port}`);
  console.log(`🤖 Gemini AI: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`🔍 Google Search: ${process.env.GOOGLE_SEARCH_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`🌐 Web Analysis: ${process.env.GOOGLE_SEARCH_API_KEY ? '✅ Full capabilities' : '⚠️ Limited (AI only)'}`);
  console.log(`📊 Features: ${process.env.GOOGLE_SEARCH_API_KEY ? 'Two-Step URL + Enhanced Text Analysis' : 'Basic AI Analysis'}`);
  console.log('🚀 ================================\n');
  
  // Log available endpoints
  console.log('📋 Available endpoints:');
  console.log('   POST /api/analyze - Main analysis');
  console.log('   GET  /api/test - Health check');
  console.log('   GET  /api/history - View history');
  console.log('   DELETE /api/history - Clear history');
  console.log('   GET  /api/history/stats - Statistics');
  console.log('');
});