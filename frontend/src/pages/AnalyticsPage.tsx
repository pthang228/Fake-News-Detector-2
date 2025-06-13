import AnalyticsForm from "../components/Analytics/AnalyticsForm";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useFirebaseHistory } from "../hooks/useFirebaseHistory";

const AnalyticsPage = () => {
  const [result, setResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { saveAnalysis } = useFirebaseHistory();

  const handleAnalytics = async (message: string) => {
    try {
      // Gọi API phân tích
      const res = await fetch("http://localhost:5000/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();

      if (data.success) {
        const analysisResult = data.analysis;
        setResult(analysisResult);

        // Lưu vào Firebase nếu người dùng đã đăng nhập
        if (user && analysisResult) {
          setSaving(true);
          try {
            await saveAnalysis({
              text: message,
              result: analysisResult,
              sourcesAnalyzed: analysisResult.sourcesAnalyzed || 0,
              analysisType: data.statistics?.analysisMode || "Text Analysis",
              originalUrl: analysisResult.originalUrl,
              twoStepProcess: analysisResult.twoStepProcess || false
            });
            console.log("✅ Đã lưu phân tích vào Firebase");
          } catch (error) {
            console.error("❌ Lỗi khi lưu vào Firebase:", error);
            // Không hiển thị lỗi cho user vì phân tích vẫn thành công
          } finally {
            setSaving(false);
          }
        }
      } else {
        setResult({ error: data.error || "Lỗi khi phân tích" });
      }
    } catch (error) {
      console.error("❌ Lỗi khi phân tích:", error);
      setResult({ error: "Lỗi kết nối đến server" });
    }
  };

  return (
    <div>
      <AnalyticsForm onAnalytic={handleAnalytics} />

      {/* Hiển thị trạng thái lưu */}
      {saving && (
        <div style={{ 
          padding: "1rem", 
          background: "rgba(6, 182, 212, 0.1)", 
          border: "1px solid rgba(6, 182, 212, 0.3)",
          borderRadius: "8px",
          color: "#06b6d4",
          marginTop: "1rem",
          textAlign: "center"
        }}>
          🔄 Đang lưu kết quả phân tích...
        </div>
      )}

      {/* Hiển thị kết quả phân tích nếu có */}
      {result && !result.error && (
        <div style={{
          padding: "2rem",
          background: "rgba(30, 41, 59, 0.7)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(99, 102, 241, 0.2)",
          borderRadius: "16px",
          marginTop: "2rem",
          color: "#f8fafc"
        }}>
          <h3 style={{ color: "#06b6d4", marginBottom: "1rem" }}>📊 Kết quả phân tích</h3>
          
          <div style={{ display: "grid", gap: "1rem" }}>
            <div>
              <strong>Fake News:</strong> 
              <span style={{ 
                color: result.isFakeNews ? "#fca5a5" : "#86efac",
                marginLeft: "0.5rem",
                fontWeight: "600"
              }}>
                {result.isFakeNews ? "Có" : "Không"}
              </span>
            </div>
            
            <div>
              <strong>Độ tin cậy:</strong> 
              <span style={{ marginLeft: "0.5rem", fontWeight: "600" }}>
                {result.confidence}%
              </span>
            </div>
            
            <div>
              <strong>Lý do:</strong> 
              <p style={{ margin: "0.5rem 0", lineHeight: "1.6" }}>
                {result.reason}
              </p>
            </div>
            
            {result.indicators && result.indicators.length > 0 && (
              <div>
                <strong>Dấu hiệu:</strong>
                <ul style={{ margin: "0.5rem 0", paddingLeft: "1.5rem" }}>
                  {result.indicators.map((indicator: string, index: number) => (
                    <li key={index} style={{ marginBottom: "0.25rem" }}>
                      {indicator}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div>
              <strong>Khuyến nghị:</strong>
              <p style={{ margin: "0.5rem 0", lineHeight: "1.6" }}>
                {result.recommendation}
              </p>
            </div>

            {/* Hiển thị thông tin bổ sung nếu có */}
            {result.sourcesAnalyzed > 0 && (
              <div>
                <strong>Nguồn phân tích:</strong> 
                <span style={{ marginLeft: "0.5rem" }}>
                  {result.sourcesAnalyzed} nguồn
                </span>
              </div>
            )}

            {result.twoStepProcess && (
              <div>
                <strong>Quy trình:</strong> 
                <span style={{ marginLeft: "0.5rem", color: "#06b6d4" }}>
                  Two-Step Analysis
                </span>
              </div>
            )}

            {result.originalUrl && (
              <div>
                <strong>URL gốc:</strong>
                <a 
                  href={result.originalUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    marginLeft: "0.5rem", 
                    color: "#06b6d4",
                    textDecoration: "underline",
                    wordBreak: "break-all"
                  }}
                >
                  {result.originalUrl}
                </a>
              </div>
            )}
          </div>

          {user && (
            <div style={{ 
              marginTop: "1rem", 
              padding: "0.75rem", 
              background: "rgba(16, 185, 129, 0.1)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "8px",
              fontSize: "0.9rem",
              color: "#86efac"
            }}>
              ✅ Kết quả đã được lưu vào lịch sử cá nhân
            </div>
          )}
        </div>
      )}

      {/* Hiển thị lỗi nếu có */}
      {result && result.error && (
        <div style={{ 
          padding: "1rem", 
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: "8px",
          color: "#fca5a5", 
          marginTop: "1rem"
        }}>
          ❌ {result.error}
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;