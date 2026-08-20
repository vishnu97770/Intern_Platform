import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("InternshipsPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows search results once authenticated", async () => {
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
      if (url.includes("/internships")) {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                id: "i1",
                title: "Backend Developer Intern",
                company: "Northwind Systems",
                location: "Bengaluru, India",
                workMode: "HYBRID",
                stipendMin: 20000,
                stipendMax: 30000,
                stipendCurrency: "INR",
                durationMonths: 6,
                applicationDeadline: new Date(Date.now() + 86400000 * 10).toISOString(),
                source: "Seed Internships (Mock Provider)",
                sourceUrl: "https://example.invalid/1",
                applicationUrl: "https://example.invalid/1/apply",
                discoveredAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                requiredSkills: ["Go", "Python"],
                preferredSkills: ["Docker"],
              },
            ],
            total: 1,
            page: 1,
            pageSize: 10,
            totalPages: 1,
          }),
        );
      }
      return Promise.resolve(jsonResponse({}, 200));
    });

    render(
      <MemoryRouter initialEntries={["/internships"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /^internships$/i })).toBeInTheDocument();
    expect(await screen.findByText("Backend Developer Intern")).toBeInTheDocument();
    expect(screen.getByText(/Northwind Systems/)).toBeInTheDocument();
    expect(screen.getByText("Go")).toBeInTheDocument();
  });
});
