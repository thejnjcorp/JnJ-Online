import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'markdown-to-jsx';
import { keepBlankLines } from '../../src/utils/markdownBlankLines';

const render = markdown => renderToStaticMarkup(React.createElement(Markdown, { options: { disableParsingRawHTML: true } }, markdown));
const paragraphs = html => [...html.matchAll(/<p>(.*?)<\/p>/g)].map(match => match[1]);

describe('keepBlankLines', () => {
    test('text with no extra blank lines is left exactly as it was', () => {
        const markdown = '## Heading\n\nSome **bold** text.\n\n- one\n- two\n\nLast.';
        expect(keepBlankLines(markdown)).toBe(markdown);
        expect(keepBlankLines('')).toBe('');
        expect(keepBlankLines('one line')).toBe('one line');
    });

    test('an empty paragraph (Enter twice) becomes a line the renderer shows as blank', () => {
        expect(keepBlankLines('a\n\n\n\nb')).toBe('a\n\n&nbsp;\n\nb');
    });

    test('several empty paragraphs become that many blank lines', () => {
        expect(keepBlankLines('a\n\n\n\n\n\nb')).toBe('a\n\n&nbsp;\n\n&nbsp;\n\nb');
        expect(keepBlankLines('a\n\n\n\n\n\n\n\nb')).toBe('a\n\n&nbsp;\n\n&nbsp;\n\n&nbsp;\n\nb');
    });

    test('a paragraph holding only a non-breaking or zero-width space is written the same way', () => {
        expect(keepBlankLines('a\n\n \n\nb')).toBe('a\n\n&nbsp;\n\nb');
        expect(keepBlankLines('a\n\n​\n\nb')).toBe('a\n\n&nbsp;\n\nb');
        expect(keepBlankLines('a\n\n  \n\nb')).toBe('a\n\n&nbsp;\n\nb');
    });

    test('a non-breaking space inside a line of text is not touched', () => {
        expect(keepBlankLines('a b\n\nc  ')).toBe('a b\n\nc  ');
    });

    test('saving it again changes nothing, so an edit elsewhere does not disturb the blank line', () => {
        const once = keepBlankLines('a\n\n\n\nb');
        expect(keepBlankLines(once)).toBe(once);
    });

    test('a line break inside a paragraph (two trailing spaces) is not mistaken for a blank line', () => {
        const markdown = 'one  \ntwo\n\nthree';
        expect(keepBlankLines(markdown)).toBe(markdown);
    });

    describe('what the renderer makes of it', () => {
        test('an extra blank line is a paragraph with something in it, so it takes up a line', () => {
            expect(paragraphs(render(keepBlankLines('a\n\n\n\nb')))).toEqual(['a', ' ', 'b']);
        });

        test('a bare non-breaking space would have been an empty paragraph (nothing to see) - which is the problem', () => {
            expect(paragraphs(render('a\n\n \n\nb'))).toEqual(['a', '', 'b']);
            expect(paragraphs(render(keepBlankLines('a\n\n \n\nb')))).toEqual(['a', ' ', 'b']);
        });

        test('without it, extra blank lines vanish', () => {
            expect(paragraphs(render('a\n\n\n\nb'))).toEqual(['a', 'b']);
        });
    });
});
