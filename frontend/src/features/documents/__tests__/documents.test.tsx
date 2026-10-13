import { describe, it, expect } from "vitest";
import { screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { axe } from "vitest-axe";
import { server } from "@/shared/testing/setup";
import { renderWithProviders } from "@/shared/testing/utils";
import { makeDocument } from "@/shared/testing/factories";
import { DocumentsPage } from "../pages/DocumentsPage";

describe("Documents Feature (Phase 6)", () => {
  it("renders uploaded documents list with category and formatted size, passing axe", async () => {
    server.use(
      http.get(new RegExp("/api/v1/documents$"), () => {
        return HttpResponse.json([
          makeDocument({
            id: "doc_1",
            title: "Car Loan Sanction Letter",
            category: "financial",
            filename: "sanction_letter.pdf",
            size_bytes: 2 * 1024 * 1024,
            created_at: "2026-05-10T10:00:00Z",
          }),
        ]);
      }),
    );

    const { container } = renderWithProviders(<DocumentsPage />, { route: "/documents" });

    expect(
      screen.getByRole("heading", { level: 1, name: /encrypted emergency documents/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Car Loan Sanction Letter")).toBeInTheDocument();
    });

    expect(screen.getByText("sanction_letter.pdf")).toBeInTheDocument();
    expect(screen.getByText("2.0 MB")).toBeInTheDocument();
    expect(screen.getByText("financial")).toBeInTheDocument();

    // Check stated limits
    expect(screen.getByText(/stated upload limits:/i)).toBeInTheDocument();
    expect(screen.getByText(/maximum file size: 15 mb/i)).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("validates file upload: rejects oversized files (>15MB)", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<DocumentsPage />, { route: "/documents" });

    await waitFor(() => {
      expect(screen.getByText(/drag and drop your file here/i)).toBeInTheDocument();
    });

    const bigFile = new File([new Uint8Array(16 * 1024 * 1024)], "huge.pdf", {
      type: "application/pdf",
    });
    const fileInput = screen.getByLabelText(/choose document file/i);

    await user.upload(fileInput, bigFile);
    expect(await screen.findByText(/file size exceeds 15 mb limit/i)).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("validates file upload: rejects unsupported file types", async () => {
    const { container } = renderWithProviders(<DocumentsPage />, { route: "/documents" });

    await waitFor(() => {
      expect(screen.getByText(/drag and drop your file here/i)).toBeInTheDocument();
    });

    const exeFile = new File(["executable content"], "malicious.exe", {
      type: "application/x-msdownload",
    });
    const fileInput = screen.getByLabelText(/choose document file/i);

    fireEvent.change(fileInput, { target: { files: [exeFile] } });
    expect(
      await screen.findByText(
        /unsupported file type\. only pdf, png, and jpeg documents are permitted/i,
      ),
    ).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("uploads a valid file and triggers delete confirmation dialog", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(new RegExp("/api/v1/documents$"), () => {
        return HttpResponse.json([
          makeDocument({
            id: "doc_will",
            title: "Family Will and Testament",
            filename: "will.pdf",
            size_bytes: 512 * 1024,
          }),
        ]);
      }),
    );

    const { container } = renderWithProviders(<DocumentsPage />, { route: "/documents" });

    await waitFor(() => {
      expect(screen.getByText("Family Will and Testament")).toBeInTheDocument();
    });

    // Click delete
    const deleteBtn = screen.getByRole("button", { name: /delete/i });
    await user.click(deleteBtn);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/delete document\?/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/family will and testament/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/this encrypted file will be removed from your secure storage/i),
    ).toBeInTheDocument();

    const confirmBtn = within(dialog).getByRole("button", { name: /^delete document$/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});
