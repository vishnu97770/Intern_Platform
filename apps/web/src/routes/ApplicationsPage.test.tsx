import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("ApplicationsPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists tracked applications with status and match score once authenticated", async () => {
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
      if (url.includes("/applications")) {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                id: "app1",
                internship: { id: "i1", title: "Backend Developer Intern", company: "Northwind Systems", source: "Seed Internships" },
                matchScore: 91,
                status: "APPLIED",
                method: "MANUAL",
                applicationUrl: "https://example.invalid/apply",
                appliedAt: new Date().toISOString(),
                failureReason: null,
                notes: null,
                attempts: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
            totalPages: 1,
          }),
        );
      }
      return Promise.resolve(jsonResponse({}, 200));
    });

    render(
      <MemoryRouter initialEntries={["/applications"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /^applications$/i })).toBeInTheDocument();
    expect(await screen.findByText("Backend Developer Intern")).toBeInTheDocument();
    expect(screen.getByText(/Match: 91%/)).toBeInTheDocument();
    // "APPLIED" appears both as a filter chip and as the application's status badge.
    expect(screen.getAllByText("APPLIED").length).toBeGreaterThanOrEqual(2);
  });
});
