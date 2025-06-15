// frontend/src/services/firebase/adminService.ts
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  deleteDoc, 
  doc,
  where,
  writeBatch,
  limit,
  getCountFromServer,
  Timestamp
} from "firebase/firestore";
import { db } from './firebaseConfig';
import { AnalysisEntry } from './firestoreService';

export interface AdminUserData {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
  lastLoginAt: string;
  analysisCount: number;
  fakeNewsCount: number;
  realNewsCount: number;
  role: string;
  isActive: boolean;
}

export interface AdminDashboardStats {
  totalUsers: number;
  totalAnalyses: number;
  fakeNewsDetected: number;
  realNewsDetected: number;
  todayAnalyses: number;
  weekAnalyses: number;
  monthAnalyses: number;
  activeUsers: number;
  avgAnalysesPerUser: number;
  topAnalysisDay: {
    date: string;
    count: number;
  };
}

export interface SystemActivity {
  date: string;
  analysisCount: number;
  userCount: number;
  fakeNewsCount: number;
  realNewsCount: number;
}

class AdminService {
  private readonly COLLECTION_NAME = "analysisHistory";

  // Get comprehensive dashboard statistics
  async getDashboardStats(): Promise<AdminDashboardStats> {
    try {
      console.log('🔄 Fetching comprehensive dashboard stats...');

      // Get all analyses for detailed stats
      const analysesQuery = query(
        collection(db, this.COLLECTION_NAME),
        orderBy('createdAt', 'desc'),
        limit(2000) // Increased limit for better stats
      );
      
      const analysesSnapshot = await getDocs(analysesQuery);
      const allAnalyses: AnalysisEntry[] = [];
      
      analysesSnapshot.forEach((doc) => {
        const data = doc.data();
        allAnalyses.push({
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

      // Calculate time-based statistics
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const fakeCount = allAnalyses.filter(a => a.result.isFakeNews).length;
      const realCount = allAnalyses.length - fakeCount;
      
      const todayCount = allAnalyses.filter(a => 
        new Date(a.timestamp) >= today
      ).length;
      
      const weekCount = allAnalyses.filter(a => 
        new Date(a.timestamp) >= weekAgo
      ).length;
      
      const monthCount = allAnalyses.filter(a => 
        new Date(a.timestamp) >= monthAgo
      ).length;
      
      const uniqueUsers = new Set(allAnalyses.map(a => a.userId));
      const activeUsers = new Set(
        allAnalyses.filter(a => 
          new Date(a.timestamp) >= weekAgo
        ).map(a => a.userId)
      ).size;

      // Find top analysis day
      const dailyAnalyses = new Map<string, number>();
      allAnalyses.forEach(analysis => {
        const date = new Date(analysis.timestamp).toDateString();
        dailyAnalyses.set(date, (dailyAnalyses.get(date) || 0) + 1);
      });

      let topAnalysisDay = { date: '', count: 0 };
      for (const [date, count] of dailyAnalyses.entries()) {
        if (count > topAnalysisDay.count) {
          topAnalysisDay = { date, count };
        }
      }

      const stats: AdminDashboardStats = {
        totalUsers: uniqueUsers.size,
        totalAnalyses: allAnalyses.length,
        fakeNewsDetected: fakeCount,
        realNewsDetected: realCount,
        todayAnalyses: todayCount,
        weekAnalyses: weekCount,
        monthAnalyses: monthCount,
        activeUsers: activeUsers,
        avgAnalysesPerUser: uniqueUsers.size > 0 ? Math.round(allAnalyses.length / uniqueUsers.size) : 0,
        topAnalysisDay
      };

      console.log('📊 Dashboard stats calculated:', stats);
      return stats;

    } catch (error) {
      console.error('❌ Error fetching dashboard stats:', error);
      throw new Error('Failed to fetch dashboard statistics');
    }
  }

  // Get all analysis history for admin view
  async getAllAnalysisHistory(limitCount: number = 500): Promise<AnalysisEntry[]> {
    try {
      console.log(`🔄 Fetching all analysis history (limit: ${limitCount})...`);

      const q = query(
        collection(db, this.COLLECTION_NAME),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const history: AnalysisEntry[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
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

      console.log(`📋 Loaded ${history.length} analysis records`);
      return history;

    } catch (error) {
      console.error('❌ Error fetching all history:', error);
      throw new Error('Failed to fetch analysis history');
    }
  }

  // Get all users with their analysis statistics
  async getAllUsersWithStats(): Promise<AdminUserData[]> {
    try {
      console.log('🔄 Fetching all users with statistics...');

      // Get all analyses to calculate user stats
      const analysesQuery = query(
        collection(db, this.COLLECTION_NAME),
        orderBy('createdAt', 'desc')
      );
      
      const analysesSnapshot = await getDocs(analysesQuery);
      const userStatsMap = new Map<string, {
        email: string;
        analysisCount: number;
        fakeNewsCount: number;
        realNewsCount: number;
        lastActivity: string;
        firstActivity: string;
      }>();

      // Process all analyses to build user statistics
      analysesSnapshot.forEach((doc) => {
        const data = doc.data();
        const userId = data.userId;
        const userEmail = data.userEmail;
        const timestamp = data.createdAt?.toDate().toISOString() || new Date().toISOString();
        const isFakeNews = data.result?.isFakeNews || false;

        if (userStatsMap.has(userId)) {
          const existing = userStatsMap.get(userId)!;
          userStatsMap.set(userId, {
            ...existing,
            analysisCount: existing.analysisCount + 1,
            fakeNewsCount: isFakeNews ? existing.fakeNewsCount + 1 : existing.fakeNewsCount,
            realNewsCount: !isFakeNews ? existing.realNewsCount + 1 : existing.realNewsCount,
            lastActivity: timestamp > existing.lastActivity ? timestamp : existing.lastActivity,
            firstActivity: timestamp < existing.firstActivity ? timestamp : existing.firstActivity
          });
        } else {
          userStatsMap.set(userId, {
            email: userEmail,
            analysisCount: 1,
            fakeNewsCount: isFakeNews ? 1 : 0,
            realNewsCount: !isFakeNews ? 1 : 0,
            lastActivity: timestamp,
            firstActivity: timestamp
          });
        }
      });

      // Convert to AdminUserData array
      const usersData: AdminUserData[] = Array.from(userStatsMap.entries()).map(([uid, stats]) => {
        const lastActivityDate = new Date(stats.lastActivity);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        return {
          uid,
          email: stats.email,
          displayName: stats.email.split('@')[0], // Extract name from email
          createdAt: stats.firstActivity,
          lastLoginAt: stats.lastActivity,
          analysisCount: stats.analysisCount,
          fakeNewsCount: stats.fakeNewsCount,
          realNewsCount: stats.realNewsCount,
          role: 'user', // Default role
          isActive: lastActivityDate >= weekAgo
        };
      });

      // Sort by analysis count descending
      usersData.sort((a, b) => b.analysisCount - a.analysisCount);

      console.log(`👥 Loaded ${usersData.length} users with statistics`);
      return usersData;

    } catch (error) {
      console.error('❌ Error fetching users:', error);
      throw new Error('Failed to fetch users data');
    }
  }

  // Delete user and all their data
  async deleteUserAndAllData(userId: string): Promise<{
    deletedAnalyses: number;
    success: boolean;
  }> {
    try {
      console.log(`🗑️ Starting deletion process for user: ${userId}`);

      // Get all user's analyses
      const userAnalysesQuery = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', userId)
      );

      const userAnalysesSnapshot = await getDocs(userAnalysesQuery);
      const analysisCount = userAnalysesSnapshot.size;

      if (analysisCount === 0) {
        console.log('👤 No analyses found for user');
        return { deletedAnalyses: 0, success: true };
      }

      // Delete all user's analyses in batches (Firestore batch limit is 500)
      const batchSize = 450; // Safe batch size
      let deletedCount = 0;
      
      const docs = userAnalysesSnapshot.docs;
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchDocs = docs.slice(i, i + batchSize);
        
        batchDocs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        deletedCount += batchDocs.length;
        
        console.log(`🗑️ Deleted batch: ${deletedCount}/${analysisCount} analyses`);
      }

      console.log(`✅ Successfully deleted user ${userId} and ${deletedCount} analyses`);
      return { deletedAnalyses: deletedCount, success: true };

    } catch (error) {
      console.error('❌ Error deleting user data:', error);
      throw new Error(`Failed to delete user data: ${(error as Error).message}`);
    }
  }

  // Get system activity over time (for charts)
  async getSystemActivity(days: number = 30): Promise<SystemActivity[]> {
    try {
      console.log(`📈 Fetching system activity for last ${days} days...`);

      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const dailyActivity = new Map<string, {
        analysisCount: number;
        users: Set<string>;
        fakeNews: number;
        realNews: number;
      }>();

      // Process data day by day
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const date = data.createdAt?.toDate();
        if (!date) return;

        const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
        const isFakeNews = data.result?.isFakeNews || false;

        if (dailyActivity.has(dateKey)) {
          const existing = dailyActivity.get(dateKey)!;
          existing.analysisCount++;
          existing.users.add(data.userId);
          if (isFakeNews) {
            existing.fakeNews++;
          } else {
            existing.realNews++;
          }
        } else {
          dailyActivity.set(dateKey, {
            analysisCount: 1,
            users: new Set([data.userId]),
            fakeNews: isFakeNews ? 1 : 0,
            realNews: isFakeNews ? 0 : 1
          });
        }
      });

      // Convert to array and fill missing days
      const activity: SystemActivity[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateKey = date.toISOString().split('T')[0];
        const dayData = dailyActivity.get(dateKey);

        activity.push({
          date: dateKey,
          analysisCount: dayData?.analysisCount || 0,
          userCount: dayData?.users.size || 0,
          fakeNewsCount: dayData?.fakeNews || 0,
          realNewsCount: dayData?.realNews || 0
        });
      }

      console.log(`📈 System activity calculated for ${activity.length} days`);
      return activity;

    } catch (error) {
      console.error('❌ Error fetching system activity:', error);
      throw new Error('Failed to fetch system activity');
    }
  }

  // Search and filter analysis history
  async searchAnalysisHistory(
    searchTerm?: string,
    filterType?: string,
    sortBy?: string,
    limitCount: number = 200
  ): Promise<AnalysisEntry[]> {
    try {
      console.log('🔍 Searching analysis history...', { searchTerm, filterType, sortBy });

      // Base query
      let q = query(
        collection(db, this.COLLECTION_NAME),
        orderBy('createdAt', sortBy === 'oldest' ? 'asc' : 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      let history: AnalysisEntry[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
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

      // Apply client-side filtering
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        history = history.filter(item => 
          item.text.toLowerCase().includes(searchLower) ||
          item.userEmail.toLowerCase().includes(searchLower) ||
          (item.result.reason && item.result.reason.toLowerCase().includes(searchLower)) ||
          (item.originalUrl && item.originalUrl.toLowerCase().includes(searchLower))
        );
      }

      if (filterType && filterType !== 'all') {
        history = history.filter(item => {
          switch (filterType) {
            case 'fake':
              return item.result.isFakeNews;
            case 'real':
              return !item.result.isFakeNews;
            case 'url':
              return !!item.originalUrl;
            case 'text':
              return !item.originalUrl;
            default:
              return true;
          }
        });
      }

      console.log(`🔍 Search completed: ${history.length} results`);
      return history;

    } catch (error) {
      console.error('❌ Error searching history:', error);
      throw new Error('Failed to search analysis history');
    }
  }

  // Get total count of documents (for pagination)
  async getTotalAnalysisCount(): Promise<number> {
    try {
      const coll = collection(db, this.COLLECTION_NAME);
      const snapshot = await getCountFromServer(coll);
      return snapshot.data().count;
    } catch (error) {
      console.error('❌ Error getting total count:', error);
      return 0;
    }
  }

  // Clear all system data (dangerous - admin only)
  async clearAllSystemData(): Promise<{
    deletedAnalyses: number;
    success: boolean;
  }> {
    try {
      console.log('🚨 WARNING: Starting system-wide data deletion...');

      const q = query(collection(db, this.COLLECTION_NAME));
      const querySnapshot = await getDocs(q);
      const totalDocs = querySnapshot.size;

      if (totalDocs === 0) {
        return { deletedAnalyses: 0, success: true };
      }

      // Delete in batches
      const batchSize = 450;
      let deletedCount = 0;
      
      const docs = querySnapshot.docs;
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchDocs = docs.slice(i, i + batchSize);
        
        batchDocs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        deletedCount += batchDocs.length;
        
        console.log(`🗑️ Deleted batch: ${deletedCount}/${totalDocs} documents`);
      }

      console.log(`🚨 SYSTEM CLEARED: Deleted ${deletedCount} total documents`);
      return { deletedAnalyses: deletedCount, success: true };

    } catch (error) {
      console.error('❌ Error clearing system data:', error);
      throw new Error(`Failed to clear system data: ${(error as Error).message}`);
    }
  }
}

export const adminService = new AdminService();
export default adminService;