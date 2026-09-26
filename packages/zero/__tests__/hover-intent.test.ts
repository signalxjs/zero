import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHoverIntent } from '../src/behaviors/hover-intent.js';

describe('createHoverIntent', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('opens after the delay, or at once for 0', () => {
        const set = vi.fn();
        const intent = createHoverIntent(set);
        intent.open(100);
        expect(set).not.toHaveBeenCalled();
        vi.advanceTimersByTime(100);
        expect(set).toHaveBeenLastCalledWith(true);
        intent.close(0);
        expect(set).toHaveBeenLastCalledWith(false);
    });

    it('a close cancels a pending open, and an open cancels a pending close', () => {
        const set = vi.fn();
        const intent = createHoverIntent(set);
        intent.open(100);
        intent.close(50);
        vi.advanceTimersByTime(200);
        expect(set.mock.calls).toEqual([[false]]);
        set.mockClear();
        intent.close(50);
        intent.open(0);
        vi.advanceTimersByTime(200);
        expect(set.mock.calls).toEqual([[true]]);
    });

    it('cancelClose keeps a pending open; cancel drops both', () => {
        const set = vi.fn();
        const intent = createHoverIntent(set);
        intent.close(50);
        intent.cancelClose();
        vi.advanceTimersByTime(100);
        expect(set).not.toHaveBeenCalled();
        intent.open(50);
        intent.cancelClose();
        vi.advanceTimersByTime(50);
        expect(set).toHaveBeenLastCalledWith(true);
        set.mockClear();
        intent.open(50);
        intent.cancel();
        vi.advanceTimersByTime(100);
        expect(set).not.toHaveBeenCalled();
    });
});
