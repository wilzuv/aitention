import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownContent } from "../MarkdownContent";

describe("MarkdownContent", () => {
  it("renders bold text as <strong>", () => {
    render(<MarkdownContent content="Hello **world**" />);
    const strong = screen.getByText("world");
    expect(strong.tagName).toBe("STRONG");
  });

  it("renders unordered lists", () => {
    const { container } = render(
      <MarkdownContent content={"- Item one\n- Item two"} />
    );
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe("Item one");
    expect(items[1].textContent).toBe("Item two");
  });

  it("renders inline code", () => {
    render(<MarkdownContent content="Use `console.log` here" />);
    const code = screen.getByText("console.log");
    expect(code.tagName).toBe("CODE");
  });

  it("renders code blocks", () => {
    const { container } = render(
      <MarkdownContent content={'```\nconst x = 1;\n```'} />
    );
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre!.textContent).toContain("const x = 1;");
  });

  it("renders links that open in a new tab", () => {
    render(<MarkdownContent content="Visit [example](https://example.com)" />);
    const link = screen.getByText("example");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("passes className to the wrapper", () => {
    const { container } = render(
      <MarkdownContent content="test" className="custom-class" />
    );
    expect(container.firstElementChild!.classList.contains("custom-class")).toBe(true);
  });

  it("renders markdown tables", () => {
    const table = "| Week | Goal | Status |\n| --- | --- | --- |\n| Jan 19 | Fix slowness | Completed |";
    const { container } = render(<MarkdownContent content={table} />);
    const tableEl = container.querySelector("table");
    expect(tableEl).not.toBeNull();
    const headers = container.querySelectorAll("th");
    expect(headers).toHaveLength(3);
    expect(headers[0].textContent).toBe("Week");
    const cells = container.querySelectorAll("td");
    expect(cells).toHaveLength(3);
    expect(cells[1].textContent).toBe("Fix slowness");
  });

  it("renders strikethrough text", () => {
    render(<MarkdownContent content="This is ~~deleted~~ text" />);
    const del = document.querySelector("del");
    expect(del).not.toBeNull();
    expect(del!.textContent).toBe("deleted");
  });

  it("renders plain text without extra wrappers beyond <p>", () => {
    const { container } = render(<MarkdownContent content="Just text" />);
    const p = container.querySelector("p");
    expect(p).not.toBeNull();
    expect(p!.textContent).toBe("Just text");
  });
});
