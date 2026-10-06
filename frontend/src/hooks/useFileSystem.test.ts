import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileSystem } from './useFileSystem';

describe('useFileSystem hook', () => {
  it('initializes with empty state and detects electronAPI', () => {
    const { result } = renderHook(() => useFileSystem());
    expect(result.current.workspaceRoot).toBeNull();
    expect(result.current.files).toEqual([]);
    expect(result.current.isElectron).toBe(false);
  });

  it('calls openFolder and updates state when electronAPI is present', async () => {
    const mockFiles = [
      { name: 'src', isDirectory: true, path: '/test/src' },
      { name: 'package.json', isDirectory: false, path: '/test/package.json' }
    ];

    window.electronAPI = {
      fs: {
        openFolder: vi.fn().mockResolvedValue('/test'),
        readDir: vi.fn().mockResolvedValue(mockFiles),
        readFile: vi.fn(),
        writeFile: vi.fn(),
        createDir: vi.fn(),
        delete: vi.fn(),
        rename: vi.fn(),
        onFSEvent: vi.fn(),
        removeFSEventListener: vi.fn(),
      }
    };

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFolder();
    });

    expect(window.electronAPI.fs.openFolder).toHaveBeenCalled();
    expect(window.electronAPI.fs.readDir).toHaveBeenCalledWith('/test');
    expect(result.current.workspaceRoot).toBe('/test');
    expect(result.current.files).toEqual(mockFiles);
  });
});
