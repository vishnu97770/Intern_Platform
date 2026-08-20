import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { NavBar } from "./components/NavBar";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LandingPage } from "./routes/LandingPage";
import { LoginPage } from "./routes/LoginPage";
import { RegisterPage } from "./routes/RegisterPage";
import { DashboardPage } from "./routes/DashboardPage";
import { ProfilePage } from "./routes/ProfilePage";
import { ResumePage } from "./routes/ResumePage";
import { InternshipsPage } from "./routes/InternshipsPage";
import { InternshipDetailPage } from "./routes/InternshipDetailPage";
import { ApplicationsPage } from "./routes/ApplicationsPage";
import { NotFoundPage } from "./routes/NotFoundPage";

export function App() {
  return (
    <AuthProvider>
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resume"
            element={
              <ProtectedRoute>
                <ResumePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/internships"
            element={
              <ProtectedRoute>
                <InternshipsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/internships/:id"
            element={
              <ProtectedRoute>
                <InternshipDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/applications"
            element={
              <ProtectedRoute>
                <ApplicationsPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </AuthProvider>
  );
}
