import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("App routing + auth", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redirects an unauthenticated visitor from a protected route to /login", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse({ error: { message: "no session" } }, 401));

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
  });

  it("lets a visitor register and land on the dashboard", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/refresh")) return Promise.resolve(jsonResponse({ error: {} }, 401));
      if (url.includes("/auth/register")) {
        return Promise.resolve(
          jsonResponse(
            {
              user: { id: "u1", email: "new@example.com", createdAt: new Date().toISOString() },
              accessToken: "test-access-token",
              expiresIn: 900,
            },
            201,
          ),
        );
      }
      if (url.includes("/matches/recommendations")) {
        return Promise.resolve(jsonResponse({ items: [], total: 0, page: 1, pageSize: 3, totalPages: 1 }));
      }
      return Promise.resolve(jsonResponse({}, 200));
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/register"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /create your account/i });

    await user.type(screen.getByLabelText(/full name/i), "New Student");
    await user.type(screen.getByLabelText(/^email$/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "StrongPass1");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument());
  });

  it("shows the specific validation reason on a failed registration instead of the generic top-level message", async () => {
    // Regression test for the reported registration bug: the API's
    // VALIDATION_ERROR response always carries a generic top-level
    // `error.message` ("Request validation failed") plus the real,
    // actionable reason(s) in `error.details` (see errorHandler.ts).
    // apiClient.ts must surface the specific reason, not the generic one.
    (fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/refresh")) return Promise.resolve(jsonResponse({ error: {} }, 401));
      if (url.includes("/auth/register")) {
        return Promise.resolve(
          jsonResponse(
            {
              error: {
                code: "VALIDATION_ERROR",
                message: "Request validation failed",
                details: [{ path: "password", message: "Password must contain a digit" }],
              },
            },
            400,
          ),
        );
      }
      return Promise.resolve(jsonResponse({}, 200));
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/register"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /create your account/i });
    await user.type(screen.getByLabelText(/full name/i), "New Student");
    await user.type(screen.getByLabelText(/^email$/i), "new@example.com");
    // Passes the form's own client-side pattern check (has upper/lower/digit,
    // 10+ chars) so the request actually reaches the mocked API — this
    // isolates the error-*display* bug from the client-side validation fix.
    await user.type(screen.getByLabelText(/^password$/i), "StrongPass1");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("Password must contain a digit")).toBeInTheDocument();
    expect(screen.queryByText(/^Request validation failed$/)).not.toBeInTheDocument();
  });

  it("shows the landing page for an unauthenticated visitor at /", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse({ error: {} }, 401));

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /land the right internship/i })).toBeInTheDocument();
  });
});
