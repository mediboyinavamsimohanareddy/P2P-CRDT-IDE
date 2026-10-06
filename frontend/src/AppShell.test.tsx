import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AppShell } from './AppShell';

describe('AppShell Layout', () => {
  it('renders all 7 main layout regions', () => {
    render(<AppShell />);
    
    expect(screen.getByTestId('title-bar')).toBeDefined();
    expect(screen.getByTestId('project-bar')).toBeDefined();
    expect(screen.getByTestId('left-sidebar')).toBeDefined();
    expect(screen.getByTestId('main-editor-area')).toBeDefined();
    expect(screen.getByTestId('right-panel')).toBeDefined();
    expect(screen.getByTestId('bottom-panel')).toBeDefined();
    expect(screen.getByTestId('status-bar')).toBeDefined();
  });
});
