import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "./Button";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`;

export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3" aria-label="Primary">
        <NavLink to="/" className="text-base font-semibold text-brand-700">
          Intern Platform
        </NavLink>

        {user ? (
          <div className="flex items-center gap-2">
            <NavLink to="/dashboard" className={linkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/profile" className={linkClass}>
              Profile
            </NavLink>
            <NavLink to="/resume" className={linkClass}>
              Resume
            </NavLink>
            <NavLink to="/internships" className={linkClass}>
              Internships
            </NavLink>
            <Button variant="secondary" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <NavLink to="/login" className={linkClass}>
              Log in
            </NavLink>
            <NavLink to="/register" className={linkClass}>
              Sign up
            </NavLink>
          </div>
        )}
      </nav>
    </header>
  );
}
