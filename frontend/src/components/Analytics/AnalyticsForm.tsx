import React from "react";
import '../../styles/components/AnalyticsForm.css';

interface AnalyticsFormProps {
    onAnalytic: (data: string) => Promise<void>;
}

const AnalyticsForm: React.FC<AnalyticsFormProps> = ({ onAnalytic }) => {
    const [data, setData] = React.useState("");
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Reset error state
        setError(null);

        if (!data.trim()) {
            setError("Vui lòng nhập dữ liệu phân tích.");
            return;
        }

        setLoading(true);
        try {
            await onAnalytic(data.trim());
            setData(""); // Reset input after submission
            setError(null); // Clear any previous errors
        } catch (error) {
            setError("Lỗi khi gửi dữ liệu phân tích. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="analytics-form-container">
            <form className="analytics-form" onSubmit={handleSubmit}>
                <h2>Phân tích Dữ liệu</h2>

                <div className="form-group">
                    <label htmlFor="data">Dữ liệu phân tích</label>
                    <textarea
                        id="data"
                        value={data}
                        onChange={(e) => {
                            setData(e.target.value);
                            if (error) setError(null);
                        }}
                        placeholder="Nhập dữ liệu cần phân tích..."
                        className={error ? "error" : ""}
                        disabled={loading}
                        rows={1}
                        style={{ resize: 'none' }} // Bỏ overflow: 'hidden'
                        onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';

                            // Giới hạn chiều cao tối đa 200px
                            const maxHeight = 200;
                            const newHeight = Math.min(target.scrollHeight, maxHeight);
                            target.style.height = newHeight + 'px';

                            // Bật scroll khi content vượt quá maxHeight
                            if (target.scrollHeight > maxHeight) {
                                target.style.overflowY = 'auto';
                            } else {
                                target.style.overflowY = 'hidden';
                            }
                        }}
                        onWheel={(e) => {
                            const target = e.currentTarget;
                            const { scrollTop, scrollHeight, clientHeight } = target;

                            // Chỉ ngăn scroll app khi textarea đang scroll
                            if (scrollHeight > clientHeight) {
                                const isAtTop = scrollTop === 0;
                                const isAtBottom = scrollTop + clientHeight >= scrollHeight;

                                if ((e.deltaY < 0 && !isAtTop) || (e.deltaY > 0 && !isAtBottom)) {
                                    e.stopPropagation();
                                }
                            }
                        }}
                    />
                    {error && <div className="error-message">{error}</div>}
                </div>

                <button
                    type="submit"
                    disabled={loading || !data.trim()}
                    className={loading ? "loading" : ""}
                >
                    {loading ? (
                        <>
                            <span className="loading-spinner"></span>
                            Đang xử lý...
                        </>
                    ) : (
                        "Gửi Dữ liệu"
                    )}
                </button>
            </form>
        </div>
    );
};

export default AnalyticsForm;