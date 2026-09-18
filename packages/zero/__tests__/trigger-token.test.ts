import { describe, it, expect } from 'vitest';
import { replaceToken, triggerTokenAt } from '@sigx/zero';

describe('triggerTokenAt (#58)', () => {
    it('finds a trigger at the start of the text or after whitespace', () => {
        expect(triggerTokenAt('@al', 3, '@')).toEqual({ start: 0, end: 3, prefix: '@', query: 'al' });
        expect(triggerTokenAt('hi @al', 6, '@')).toEqual({ start: 3, end: 6, prefix: '@', query: 'al' });
        expect(triggerTokenAt('hi\n@', 4, '@')).toEqual({ start: 3, end: 4, prefix: '@', query: '' });
    });

    it('never inside a word — an email address opens nothing', () => {
        expect(triggerTokenAt('me@example', 10, '@')).toBeNull();
    });

    it('a later trigger inside the word is part of the query', () => {
        expect(triggerTokenAt('@a@b', 4, '@')).toEqual({ start: 0, end: 4, prefix: '@', query: 'a@b' });
        expect(triggerTokenAt('x @a@b', 6, '@')).toEqual({ start: 2, end: 6, prefix: '@', query: 'a@b' });
    });

    it('ends at whitespace: a space after the query closes the token', () => {
        expect(triggerTokenAt('@al ', 4, '@')).toBeNull();
        expect(triggerTokenAt('@al there', 9, '@')).toBeNull();
    });

    it('queries up to the caret but spans the whole word, so a commit replaces all of it', () => {
        expect(triggerTokenAt('@alice x', 3, '@')).toEqual({ start: 0, end: 6, prefix: '@', query: 'al' });
    });

    it('takes a multi-character trigger', () => {
        expect(triggerTokenAt('say ::sm', 8, '::')).toEqual({ start: 4, end: 8, prefix: '::', query: 'sm' });
        expect(triggerTokenAt('x', 1, '')).toBeNull();
    });

    it('takes a RegExp anchored at the caret, its first group the query', () => {
        const re = /(?:^|\s)[@#](\w*)/;
        expect(triggerTokenAt('see #iss', 8, re)).toEqual({ start: 3, end: 8, prefix: ' #', query: 'iss' });
        expect(triggerTokenAt('#iss', 4, re)).toEqual({ start: 0, end: 4, prefix: '#', query: 'iss' });
        expect(triggerTokenAt('a#iss', 5, re)).toBeNull();
        // Group 1 is the contract: without one (or when it sat out), no token.
        expect(triggerTokenAt('#iss', 4, /#\w*/)).toBeNull();
        expect(triggerTokenAt('#', 1, /#(\w+)?/)).toBeNull();
        // A global flag does not make the match stateful.
        const g = /[@#](\w*)/g;
        expect(triggerTokenAt('#a', 2, g)).toEqual(triggerTokenAt('#a', 2, g));
    });

    it('replaceToken puts the text in and the caret after it', () => {
        const token = triggerTokenAt('hi @al there', 6, '@')!;
        expect(replaceToken('hi @al there', token, '@Alice ')).toEqual({ text: 'hi @Alice  there', caret: 10 });
    });
});
