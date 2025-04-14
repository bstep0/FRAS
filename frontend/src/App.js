import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import AdminDashboard from "./components/AdminDashboard";
import TeacherDashboard from "./components/TeacherDashboard";
import StudentDashboard from "./components/StudentDashboard";
import StudentClasses from "./components/StudentClasses"; 
import StudentMessages from "./components/StudentMessages"; 
import LoginPage from "./components/LoginPage";
import TeacherMessages from "./components/TeacherMessages";
import TeacherClasses from "./components/TeacherClasses";
import TeacherClassView from "./components/TeacherClassView";
import TeacherMessageView from "./components/TeacherMessageView";
import StudentClassView from "./components/StudentClassView";

function App() {
  return (
    <Router>
      <Routes>
        {/* Default route redirects to login */}
        <Route path="/" element={<LoginPage />} />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminDashboard />} />

        {/* Teacher Routes */}
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/teacher/messages" element={<TeacherMessages />} />
        <Route path="/teacher/messages/:studentName" element={<TeacherMessageView />} />
        <Route path="/teacher/classes" element={<TeacherClasses />} />
        <Route path="/teacher/classes/:className" element={<TeacherClassView />} />

        {/* Student Routes */}
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/classes" element={<StudentClasses />} />
        <Route path="/student/messages" element={<StudentMessages />} />
        <Route path="/student/classes/:classId" element={<StudentClassView key={window.location.pathname} />} />


      </Routes>
    </Router>
  );
}

export default App;
