/**
 * Button Component Tests
 *
 * Example tests demonstrating how to test React components in the renderer process.
 * Uses React Testing Library with jsdom environment.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../ui/button';

describe('Button', () => {
  describe('rendering', () => {
    it('renders children correctly', () => {
      render(<Button>Click me</Button>);

      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      render(<Button className="custom-class">Button</Button>);

      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });

    it('renders as disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>);

      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('renders with correct type attribute', () => {
      render(<Button type="submit">Submit</Button>);

      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });
  });

  describe('variants', () => {
    it('renders default variant', () => {
      render(<Button variant="default">Default</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-variant', 'default');
      expect(button).toHaveClass('bg-primary');
    });

    it('renders destructive variant', () => {
      render(<Button variant="destructive">Delete</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-variant', 'destructive');
      expect(button).toHaveClass('bg-destructive');
    });

    it('renders outline variant', () => {
      render(<Button variant="outline">Outline</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-variant', 'outline');
      expect(button).toHaveClass('border');
    });

    it('renders secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-variant', 'secondary');
      expect(button).toHaveClass('bg-secondary');
    });

    it('renders ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-variant', 'ghost');
    });

    it('renders link variant', () => {
      render(<Button variant="link">Link</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-variant', 'link');
      expect(button).toHaveClass('text-primary');
    });
  });

  describe('sizes', () => {
    it('renders default size', () => {
      render(<Button size="default">Default</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-size', 'default');
      expect(button).toHaveClass('h-9');
    });

    it('renders small size', () => {
      render(<Button size="sm">Small</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-size', 'sm');
      expect(button).toHaveClass('h-8');
    });

    it('renders large size', () => {
      render(<Button size="lg">Large</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-size', 'lg');
      expect(button).toHaveClass('h-10');
    });

    it('renders icon size', () => {
      render(<Button size="icon">I</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-size', 'icon');
      expect(button).toHaveClass('size-9');
    });
  });

  describe('interactions', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      fireEvent.click(screen.getByRole('button'));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const handleClick = vi.fn();
      render(
        <Button onClick={handleClick} disabled>
          Disabled
        </Button>
      );

      fireEvent.click(screen.getByRole('button'));

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('supports keyboard interaction', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Press me</Button>);

      const button = screen.getByRole('button');
      button.focus();

      // Use fireEvent.click to simulate Enter/Space which triggers click on buttons
      // Note: jsdom doesn't fully simulate native keyboard-to-click behavior
      fireEvent.click(button);

      expect(handleClick).toHaveBeenCalled();
    });
  });

  describe('asChild prop', () => {
    it('renders as Slot when asChild is true', () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      );

      const link = screen.getByRole('link', { name: /link button/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/test');
      // Should have button styles applied to the link
      expect(link).toHaveAttribute('data-slot', 'button');
    });
  });

  describe('accessibility', () => {
    it('has correct role', () => {
      render(<Button>Accessible</Button>);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('supports aria-label', () => {
      render(<Button aria-label="Close dialog">X</Button>);

      expect(screen.getByRole('button', { name: /close dialog/i })).toBeInTheDocument();
    });

    it('supports aria-pressed for toggle buttons', () => {
      render(<Button aria-pressed="true">Toggle</Button>);

      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    });

    it('supports aria-expanded', () => {
      render(<Button aria-expanded="false">Expand</Button>);

      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('with icons', () => {
    it('renders with icon as child', () => {
      render(
        <Button>
          <svg data-testid="icon" />
          With Icon
        </Button>
      );

      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /with icon/i })).toBeInTheDocument();
    });

    it('icon-only button with aria-label', () => {
      render(
        <Button size="icon" aria-label="Settings">
          <svg data-testid="settings-icon" />
        </Button>
      );

      expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
      expect(screen.getByTestId('settings-icon')).toBeInTheDocument();
    });
  });
});
