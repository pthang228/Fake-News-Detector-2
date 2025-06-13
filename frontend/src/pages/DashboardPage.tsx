// trang chính sau khi đăng nhập, nơi phân tích fake news.
import { useAuth } from "../hooks/useAuth";

const DashboardPage: React.FC = () => {
    const auth = useAuth();
    return (
        <div>
            <h1>Welcome Admin {auth?.user?.displayName}</h1>
            {auth.role === 'admin' ? (
                <p>Bạn là admin, có quyền quản trị</p>
            ) : (
                <p>Bạn là user bình thường</p>
            )}
        </div>
    );
};

export default DashboardPage;