import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProgressiveImage } from "./ProgressiveImage";

describe("ProgressiveImage", () => {
  const mockSrc = "https://example.com/high-res.jpg";
  const mockPlaceholder = "https://example.com/thumbnail.jpg";
  const mockAlt = "Test image";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the placeholder before the full image loads", () => {
    render(<ProgressiveImage src={mockSrc} placeholder={mockPlaceholder} alt={mockAlt} />);

    // Get both images
    const placeholderImg = screen.getByAltText("");
    const highResImg = screen.getByAltText(mockAlt);

    // Placeholder should be visible (opacity-100)
    expect(placeholderImg.className).toContain("opacity-100");
    expect(placeholderImg.className).toContain("blur-[10px]");
    
    // High-res should be hidden (opacity-0)
    expect(highResImg.className).toContain("opacity-0");
  });

  it("fades in the full image after loading", () => {
    render(<ProgressiveImage src={mockSrc} placeholder={mockPlaceholder} alt={mockAlt} />);
    
    const placeholderImg = screen.getByAltText("");
    const highResImg = screen.getByAltText(mockAlt);

    // Simulate high-res image load
    fireEvent.load(highResImg);

    // High-res should become visible
    expect(highResImg.className).toContain("opacity-100");
    // Placeholder should fade out
    expect(placeholderImg.className).toContain("opacity-0");
  });

  it("immediately shows cached images", () => {
    // Override the naturalWidth and complete property to simulate a cached image
    Object.defineProperty(HTMLImageElement.prototype, "complete", {
      get: () => true,
      configurable: true,
    });
    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
      get: () => 800,
      configurable: true,
    });

    render(<ProgressiveImage src={mockSrc} placeholder={mockPlaceholder} alt={mockAlt} />);
    
    const placeholderImg = screen.getByAltText("");
    const highResImg = screen.getByAltText(mockAlt);

    // High-res should be visible immediately because it's cached
    expect(highResImg.className).toContain("opacity-100");
    expect(placeholderImg.className).toContain("opacity-0");

    // Clean up
    delete (HTMLImageElement.prototype as any).complete;
    delete (HTMLImageElement.prototype as any).naturalWidth;
  });

  it("src changes reset loading state", () => {
    const { rerender } = render(<ProgressiveImage src={mockSrc} placeholder={mockPlaceholder} alt={mockAlt} />);
    
    const highResImg = screen.getByAltText(mockAlt);
    fireEvent.load(highResImg);
    
    // Should be loaded
    expect(highResImg.className).toContain("opacity-100");

    // Change src
    rerender(<ProgressiveImage src="https://example.com/new.jpg" placeholder={mockPlaceholder} alt={mockAlt} />);
    
    const newHighResImg = screen.getByAltText(mockAlt);
    // Should be back to loading state (opacity-0)
    expect(newHighResImg.className).toContain("opacity-0");
  });

  it("image error does not break layout and shows error fallback", () => {
    render(<ProgressiveImage src={mockSrc} placeholder={mockPlaceholder} alt={mockAlt} />);
    
    const highResImg = screen.getByAltText(mockAlt);

    // Simulate error
    fireEvent.error(highResImg);

    // It should mark as loaded but also show the error state (opacity-100 for high-res native fallback)
    expect(highResImg.className).toContain("opacity-100");
    
    // Check if placeholder is unmounted
    expect(screen.queryByAltText("")).not.toBeInTheDocument();
  });
});
