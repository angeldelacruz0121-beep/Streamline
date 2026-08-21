import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('app shell', () => {
  it('mounts into the jsdom test environment', () => {
    render(<App />);

    expect(screen.getByRole('main')).toBeDefined();
  });
});
