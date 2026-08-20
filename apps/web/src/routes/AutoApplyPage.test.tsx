import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("AutoApplyPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the rule settings and queue status once authenticated", async () => {
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
      if (url.includes("/auto-apply/rule")) {
        return Promise.resolve(
          jsonResponse({
            isEnabled: false,
            minMatchScore: 80,
            maxApplicationsPerDay: 5,
            preferredRoles: ["Backend Developer"],
            preferredLocations: [],
            excludedCompanies: [],
            requireManualApproval: true,
            updatedAt: new Date().toISOString(),
          }),
        );
      }
      if (url.includes("/auto-apply/queue")) {
        return Promise.resolve(jsonResponse({ items: [], countByStatus: {} }));
      }
      return Promise.resolve(jsonResponse({}, 200));
    });

    render(
      <MemoryRouter initialEntries={["/auto-apply"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /^auto-apply$/i })).toBeInTheDocument();
    expect(await screen.findByText(/Auto Apply: OFF/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Backend Developer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run auto-apply now/i })).toBeInTheDocument();
  });
});
