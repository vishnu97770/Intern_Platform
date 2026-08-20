import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/Button";

export function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        Upload your resume once. Land the right internship.
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-base text-slate-600">
        Build your career profile, discover internships that actually match your skills, and track every
        application in one place — with auto-apply rules that only run when you say so.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        {user ? (
          <Link to="/dashboard">
            <Button>Go to dashboard</Button>
          </Link>
        ) : (
          <>
            <Link to="/register">
              <Button>Get started</Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary">Log in</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
