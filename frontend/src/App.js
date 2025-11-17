import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import AdminDashboard from "./components/AdminDashboard";
import AdminUsers from "./components/AdminUsers";
import AdminClasses from "./components/AdminClasses";
import TeacherDashboard from "./components/TeacherDashboard";
import StudentDashboard from "./components/StudentDashboard";
import StudentClasses from "./components/StudentClasses";
import StudentMessages from "./components/StudentMessages";
import LoginPage from "./components/LoginPage";
import TeacherClasses from "./components/TeacherClasses";
import TeacherClassView from "./components/TeacherClassView";
import TeacherStudentAttendance from "./components/TeacherStudentAttendance";
import StudentClassView from "./components/StudentClassView";
import NotificationsPage from "./components/notifications/NotificationsPage";
import { NotificationsProvider } from "./context/NotificationsContext";
import PrivacyPolicy from "./components/PrivacyPolicy";
import RequireRole from "./components/RequireRole";

function App() {
  return (
    <NotificationsProvider>
      <Router>
        <Routes>
          {/* Default route redirects to login */}
          <Route path="/" element={<LoginPage />} />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <RequireRole role="admin">
                <AdminDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RequireRole role="admin">
                <AdminUsers />
              </RequireRole>
            }
          />
          <Route
            path="/admin/classes"
            element={
              <RequireRole role="admin">
                <AdminClasses />
              </RequireRole>
            }
          />

          {/* Teacher Routes */}
          <Route
            path="/teacher"
            element={
              <RequireRole role="teacher">
                <TeacherDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/teacher/classes"
            element={
              <RequireRole role="teacher">
                <TeacherClasses />
              </RequireRole>
            }
          />
          <Route
            path="/teacher/classes/:className"
            element={
              <RequireRole role="teacher">
                <TeacherClassView />
              </RequireRole>
            }
          />
          <Route
            path="/teacher/classes/:className/students/:studentId"
            element={
              <RequireRole role="teacher">
                <TeacherStudentAttendance />
              </RequireRole>
            }
          />
          <Route
            path="/teacher/notifications"
            element={
              <RequireRole role="teacher">
                <NotificationsPage title="Notifications" />
              </RequireRole>
            }
          />

          {/* Student Routes */}
          <Route
            path="/student"
            element={
              <RequireRole role="student">
                <StudentDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/student/classes"
            element={
              <RequireRole role="student">
                <StudentClasses />
              </RequireRole>
            }
          />
          <Route
            path="/student/classes/:classId"
            element={
              <RequireRole role="student">
                <StudentClassView key={window.location.pathname} />
              </RequireRole>
            }
          />
          <Route
            path="/student/notifications"
            element={
              <RequireRole role="student">
                <NotificationsPage />
              </RequireRole>
            }
          />
          <Route
            path="/student/messages"
            element={
              <RequireRole role="student">
                <StudentMessages />
              </RequireRole>
            }
          />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        </Routes>
      </Router>
    </NotificationsProvider>
  );
}

export default App;
