import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextField } from "./TextField";

describe("TextField", () => {
  it("associates the label with the input for accessibility", () => {
    render(<TextField label="Email" onChange={() => {}} value="" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("renders and associates an error message via aria-describedby", () => {
    render(<TextField label="Email" error="Must be valid" onChange={() => {}} value="" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Must be valid")).toBeInTheDocument();
  });
});
