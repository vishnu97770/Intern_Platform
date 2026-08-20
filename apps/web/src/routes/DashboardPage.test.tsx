import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("DashboardPage recommendations", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows recommended internships with match scores once authenticated", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/refresh")) {
        return Promise.resolve(
          jsonResponse({
            user: { id: "u1", email: "student@example.com", createdAt: new Date().toISOString() },
            accessToken: "test-access-token",
            expiresIn: 900,
          }),
        );
      }
      if (url.includes("/matches/recommendations")) {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                internshipId: "i1",
                overallScore: 91,
                breakdown: { skillMatch: 95, educationMatch: 100, experienceMatch: 85, locationMatch: 100, roleMatch: 92 },
                explanation: { strongMatches: ["Go", "Python"], missing: ["Docker"], concerns: ["Internship requests 6 months experience"] },
                computedAt: new Date().toISOString(),
                internship: { id: "i1", title: "Backend Developer Intern", company: "Northwind Systems" },
              },
            ],
            total: 1,
            page: 1,
            pageSize: 3,
            totalPages: 1,
          }),
        );
      }
      return Promise.resolve(jsonResponse({}, 200));
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Recommended for you/i)).toBeInTheDocument();
    expect(await screen.findByText(/Backend Developer Intern/)).toBeInTheDocument();
    expect(screen.getByText("Overall Match: 91%")).toBeInTheDocument();
    expect(screen.getByText("✓ Go")).toBeInTheDocument();
    expect(screen.getByText("✗ Docker")).toBeInTheDocument();
    expect(screen.getByText(/Internship requests 6 months experience/)).toBeInTheDocument();
  });
});
