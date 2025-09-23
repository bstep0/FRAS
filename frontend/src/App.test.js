import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock(
  'react-router-dom',
  () => ({
    BrowserRouter: ({ children }) => <div>{children}</div>,
    Routes: ({ children }) => <>{children}</>,
    Route: ({ element }) => <>{element}</>,
    Link: ({ children }) => <a>{children}</a>,
    useLocation: () => ({ pathname: '/' }),
    useNavigate: () => () => {},
  }),
  { virtual: true }
);

jest.mock('./context/NotificationsContext', () => ({
  NotificationsProvider: ({ children }) => <>{children}</>,
  useNotifications: () => ({
    notifications: [],
    loading: false,
    unreadCount: 0,
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    bannerNotification: null,
    dismissBanner: jest.fn(),
    toastNotification: null,
    dismissToast: jest.fn(),
    pushToast: jest.fn(),
  }),
}));

jest.mock('./components/AdminDashboard', () => () => <div>Admin Dashboard</div>);
jest.mock('./components/TeacherDashboard', () => () => <div>Teacher Dashboard</div>);
jest.mock('./components/StudentDashboard', () => () => <div>Student Dashboard</div>);
jest.mock('./components/StudentClasses', () => () => <div>Student Classes</div>);
jest.mock('./components/StudentMessages', () => () => <div>Student Messages</div>);
jest.mock('./components/LoginPage', () => () => <div>Login Page</div>);
jest.mock('./components/TeacherMessages', () => () => <div>Teacher Messages</div>);
jest.mock('./components/TeacherClasses', () => () => <div>Teacher Classes</div>);
jest.mock('./components/TeacherClassView', () => () => <div>Teacher Class View</div>);
jest.mock('./components/TeacherMessageView', () => () => <div>Teacher Message View</div>);
jest.mock('./components/StudentClassView', () => () => <div>Student Class View</div>);

test('renders login page by default', () => {
  render(<App />);
  expect(screen.getByText(/login page/i)).toBeInTheDocument();
});
