// frontend/src/services/firestoreService.ts
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  limit, 
  where, 
  writeBatch,
  serverTimestamp,
  onSnapshot,
  Timestamp 
} from "firebase/firestore";
import { db } from "./firebaseConfig";
import type { User } from "firebase/auth";

// Types
export interface AnalysisResult {
  isFakeNews: boolean;
  confidence: number;
  reason: string;
  indicators: string[];
  recommendation: string;
  twoStepProcess?: boolean;
  sourcesAnalyzed?: number;
  identifiedTitle?: string;
  keyTopics?: string[];
  originalUrl?: string;
  webEvidenceUsed?: boolean;
}

export interface AnalysisDocument {
  id?: string;
  userId: string;
  userEmail: string;
  text: string;
  result: AnalysisResult;
  sourcesAnalyzed: number;
  analysisType: string;
  originalUrl?: string;
  twoStepProcess: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AnalysisEntry {
  id: string;
  text: string;
  result: AnalysisResult;
  sourcesAnalyzed: number;
  analysisType: string;
  timestamp: string;
  originalUrl?: string;
  twoStepProcess?: boolean;
  userId: string;
  userEmail: string;
}

const COLLECTION_NAME = "analysisHistory";

class FirestoreService {
  // Save analysis to Firestore
  async saveAnalysis(
    user: User, 
    analysisData: {
      text: string;
      result: AnalysisResult;
      sourcesAnalyzed: number;
      analysisType: string;
      originalUrl?: string;
      twoStepProcess?: boolean;
    }
  ): Promise<string> {
    try {
      const docData: Omit<AnalysisDocument, 'id'> = {
      userId: user.uid,
      userEmail: user.email || '',
      text: analysisData.text,
      result: analysisData.result,
      sourcesAnalyzed: analysisData.sourcesAnalyzed || 0,
      analysisType: analysisData.analysisType,
      twoStepProcess: analysisData.twoStepProcess || false,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp
    };

      const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);
      console.log("✅ Analysis saved with ID:", docRef.id);
      return docRef.id;
    } catch (error) {
      console.error("❌ Error saving analysis:", error);
      throw new Error("Failed to save analysis");
    }
  }

  // Get user's analysis history
  async getUserHistory(
    userId: string, 
    limitCount = 50
  ): Promise<AnalysisEntry[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const history: AnalysisEntry[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as AnalysisDocument;
        history.push({
          id: doc.id,
          text: data.text,
          result: data.result,
          sourcesAnalyzed: data.sourcesAnalyzed,
          analysisType: data.analysisType,
          timestamp: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
          originalUrl: data.originalUrl,
          twoStepProcess: data.twoStepProcess,
          userId: data.userId,
          userEmail: data.userEmail
        });
      });

      return history;
    } catch (error) {
      console.error("❌ Error getting user history:", error);
      throw new Error("Failed to get analysis history");
    }
  }

  // Search user's history
  async searchUserHistory(
    userId: string,
    searchTerm?: string,
    filterType?: string,
    sortBy = 'newest',
    limitCount = 50
  ): Promise<AnalysisEntry[]> {
    try {
      let q = query(
        collection(db, COLLECTION_NAME),
        where("userId", "==", userId)
      );

      // Apply filters
      if (filterType && filterType !== 'all') {
        switch (filterType) {
          case 'fake':
            q = query(q, where("result.isFakeNews", "==", true));
            break;
          case 'real':
            q = query(q, where("result.isFakeNews", "==", false));
            break;
          case 'url':
            q = query(q, where("originalUrl", "!=", null));
            break;
          case 'two-step':
            q = query(q, where("twoStepProcess", "==", true));
            break;
        }
      }

      // Apply sorting
      switch (sortBy) {
        case 'newest':
          q = query(q, orderBy("createdAt", "desc"));
          break;
        case 'oldest':
          q = query(q, orderBy("createdAt", "asc"));
          break;
        case 'confidence':
          q = query(q, orderBy("result.confidence", "desc"));
          break;
      }

      q = query(q, limit(limitCount));

      const querySnapshot = await getDocs(q);
      let history: AnalysisEntry[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as AnalysisDocument;
        history.push({
          id: doc.id,
          text: data.text,
          result: data.result,
          sourcesAnalyzed: data.sourcesAnalyzed,
          analysisType: data.analysisType,
          timestamp: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
          originalUrl: data.originalUrl,
          twoStepProcess: data.twoStepProcess,
          userId: data.userId,
          userEmail: data.userEmail
        });
      });

      // Client-side search filtering (since Firestore doesn't support text search well)
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        history = history.filter(item => 
          item.text.toLowerCase().includes(searchLower) ||
          item.result.reason.toLowerCase().includes(searchLower) ||
          (item.originalUrl && item.originalUrl.toLowerCase().includes(searchLower)) ||
          (item.result.identifiedTitle && item.result.identifiedTitle.toLowerCase().includes(searchLower))
        );
      }

      return history;
    } catch (error) {
      console.error("❌ Error searching history:", error);
      throw new Error("Failed to search analysis history");
    }
  }

  // Delete a specific analysis
  async deleteAnalysis(userId: string, analysisId: string): Promise<void> {
    try {
      // First verify the document belongs to the user
      const docRef = doc(db, COLLECTION_NAME, analysisId);
      const docSnap = await getDocs(query(
        collection(db, COLLECTION_NAME),
        where("userId", "==", userId)
      ));

      let found = false;
      docSnap.forEach((doc) => {
        if (doc.id === analysisId) {
          found = true;
        }
      });

      if (!found) {
        throw new Error("Analysis not found or access denied");
      }

      await deleteDoc(docRef);
      console.log("✅ Analysis deleted:", analysisId);
    } catch (error) {
      console.error("❌ Error deleting analysis:", error);
      throw new Error("Failed to delete analysis");
    }
  }

  // Clear all user's history
  async clearUserHistory(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("userId", "==", userId)
      );

      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      let count = 0;

      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
        count++;
      });

      await batch.commit();
      console.log(`✅ Cleared ${count} analyses for user ${userId}`);
      return count;
    } catch (error) {
      console.error("❌ Error clearing user history:", error);
      throw new Error("Failed to clear analysis history");
    }
  }

  // Get user statistics
  async getUserStatistics(userId: string): Promise<{
    total: number;
    fakeCount: number;
    realCount: number;
    urlAnalyses: number;
    textAnalyses: number;
    twoStepAnalyses: number;
    avgConfidence: number;
    todayCount: number;
    weekCount: number;
    monthCount: number;
  }> {
    try {
      const history = await this.getUserHistory(userId, 1000); // Get more data for stats
      
      const total = history.length;
      const fakeCount = history.filter(item => item.result.isFakeNews).length;
      const realCount = total - fakeCount;
      const urlAnalyses = history.filter(item => item.originalUrl).length;
      const textAnalyses = total - urlAnalyses;
      const twoStepAnalyses = history.filter(item => item.twoStepProcess).length;
      
      const avgConfidence = total > 0 
        ? Math.round(history.reduce((sum, item) => sum + item.result.confidence, 0) / total)
        : 0;

      // Time-based statistics
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const todayCount = history.filter(item => 
        new Date(item.timestamp) >= today
      ).length;

      const weekCount = history.filter(item => 
        new Date(item.timestamp) >= weekAgo
      ).length;

      const monthCount = history.filter(item => 
        new Date(item.timestamp) >= monthAgo
      ).length;

      return {
        total,
        fakeCount,
        realCount,
        urlAnalyses,
        textAnalyses,
        twoStepAnalyses,
        avgConfidence,
        todayCount,
        weekCount,
        monthCount
      };
    } catch (error) {
      console.error("❌ Error getting user statistics:", error);
      throw new Error("Failed to get user statistics");
    }
  }

  // Listen to real-time updates
  subscribeToUserHistory(
    userId: string, 
    callback: (history: AnalysisEntry[]) => void,
    limitCount = 50
  ): () => void {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const history: AnalysisEntry[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data() as AnalysisDocument;
        history.push({
          id: doc.id,
          text: data.text,
          result: data.result,
          sourcesAnalyzed: data.sourcesAnalyzed,
          analysisType: data.analysisType,
          timestamp: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
          originalUrl: data.originalUrl,
          twoStepProcess: data.twoStepProcess,
          userId: data.userId,
          userEmail: data.userEmail
        });
      });

      callback(history);
    });

    return unsubscribe;
  }
}

export const firestoreService = new FirestoreService();
export default firestoreService;