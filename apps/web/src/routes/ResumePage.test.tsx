import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("ResumePage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the upload form and the student's resume history once authenticated", async () => {
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
      if (url.endsWith("/resume")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: "r1",
              fileName: "resume.pdf",
              mimeType: "application/pdf",
              fileSizeBytes: 1024,
              status: "PARSED",
              parserName: "deterministic-v1",
              confidence: 0.8,
              failureReason: null,
              confirmedAt: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ]),
        );
      }
      return Promise.resolve(jsonResponse({}, 200));
    });

    render(
      <MemoryRouter initialEntries={["/resume"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /^resume$/i })).toBeInTheDocument();
    expect(await screen.findByText("resume.pdf")).toBeInTheDocument();
    expect(screen.getByText("PARSED")).toBeInTheDocument();
    expect(screen.getByLabelText(/resume file/i)).toBeInTheDocument();
  });
});
