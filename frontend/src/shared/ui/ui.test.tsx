import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  MoneyText,
  Skeleton,
  StatusPill,
} from "./index";

describe("Shared UI Primitives", () => {
  it("Button renders with variants and handles loading state", () => {
    const { rerender } = render(<Button>Click me</Button>);
    const btn = screen.getByRole("button", { name: /click me/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();

    rerender(<Button isLoading>Click me</Button>);
    expect(btn).toBeDisabled();
  });

  it("Card renders title, description, and content", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Protection Card</CardTitle>
          <CardDescription>Description text</CardDescription>
        </CardHeader>
        <CardContent>Body content</CardContent>
      </Card>,
    );
    expect(screen.getByRole("heading", { name: /protection card/i })).toBeInTheDocument();
    expect(screen.getByText("Description text")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("StatusPill renders label and accessible icon for tones", () => {
    const { rerender } = render(<StatusPill tone="success" label="Active" />);
    expect(screen.getByText("Active")).toBeInTheDocument();

    rerender(<StatusPill tone="danger" label="Urgent" />);
    expect(screen.getByText("Urgent")).toBeInTheDocument();
  });

  it("EmptyState renders icon, title, description, and action button", () => {
    render(
      <EmptyState
        title="No loans added"
        description="Add a loan obligation to track."
        action={<Button>Add Loan</Button>}
      />,
    );
    expect(screen.getByText("No loans added")).toBeInTheDocument();
    expect(screen.getByText("Add a loan obligation to track.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add loan/i })).toBeInTheDocument();
  });

  it("Skeleton renders with aria-hidden", () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    const skeletonEl = container.firstChild as HTMLElement;
    expect(skeletonEl).toHaveAttribute("aria-hidden", "true");
    expect(skeletonEl.className).toContain("animate-pulse");
  });

  it("MoneyText formats paise with accessible aria-label", () => {
    render(<MoneyText paise={1616600} />);
    const moneyEl = screen.getByText("₹16,166");
    expect(moneyEl).toBeInTheDocument();
    expect(moneyEl).toHaveAttribute("aria-label", "₹16,166 Indian Rupees");
  });

  it("ConfirmDialog opens, displays description, and fires onConfirm", async () => {
    const user = userEvent.setup();
    const handleConfirm = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={handleOpenChange}
        title="Revoke Access?"
        description="This will cancel the emergency access link immediately."
        confirmLabel="Yes, Revoke"
        onConfirm={handleConfirm}
      />,
    );

    expect(screen.getByRole("heading", { name: /revoke access\?/i })).toBeInTheDocument();
    expect(
      screen.getByText("This will cancel the emergency access link immediately."),
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /yes, revoke/i });
    await user.click(confirmBtn);
    expect(handleConfirm).toHaveBeenCalledTimes(1);

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelBtn);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});
