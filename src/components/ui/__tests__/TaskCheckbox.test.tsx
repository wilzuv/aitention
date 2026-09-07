import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskCheckbox } from "../TaskCheckbox";

describe("TaskCheckbox", () => {
  it("reports the toggled value when clicked", async () => {
    const onChange = vi.fn();
    render(<TaskCheckbox checked={false} onChange={onChange} />);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("toggles back off when already checked", async () => {
    const onChange = vi.fn();
    render(<TaskCheckbox checked onChange={onChange} />);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("does not fire onChange while disabled", async () => {
    const onChange = vi.fn();
    render(<TaskCheckbox checked={false} onChange={onChange} disabled />);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("exposes its state via aria-checked", () => {
    const { rerender } = render(<TaskCheckbox checked={false} onChange={() => {}} />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "false");

    rerender(<TaskCheckbox checked onChange={() => {}} />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
  });
});
