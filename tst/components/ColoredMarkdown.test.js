import { render, screen } from '@testing-library/react';
import ColoredMarkdown from '../../src/components/ColoredMarkdown';

describe('ColoredMarkdown', () => {
    test('renders plain markdown exactly as markdown-to-jsx alone would, with no color directive', () => {
        const { container } = render(<ColoredMarkdown>{'Some **bold** text.'}</ColoredMarkdown>);
        expect(container.querySelector('strong')).toHaveTextContent('bold');
    });

    test('forwards options (e.g. disableParsingRawHTML) when there is no color directive', () => {
        const { container } = render(<ColoredMarkdown options={{ disableParsingRawHTML: true }}>{'<b>raw</b>'}</ColoredMarkdown>);
        expect(container.querySelector('b')).not.toBeInTheDocument();
        expect(container).toHaveTextContent('<b>raw</b>');
    });

    test('a colored phrase in a plain sentence renders as a colored span, inline with the rest', () => {
        render(<ColoredMarkdown>{'Before :color[danger]{color="#ff0000"} after.'}</ColoredMarkdown>);
        const span = screen.getByText('danger');
        expect(span.tagName).toBe('SPAN');
        expect(span).toHaveStyle({ color: 'rgb(255, 0, 0)' });
        expect(span.closest('p')).toHaveTextContent('Before danger after.');
    });

    test('markdown inside the colored phrase still renders (bold, links, ...)', () => {
        const { container } = render(<ColoredMarkdown>{':color[**bold** danger]{color=red}'}</ColoredMarkdown>);
        const strong = container.querySelector('strong');
        expect(strong).toHaveTextContent('bold');
        expect(strong.closest('span')).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    });

    test('several colored phrases in the same text each get their own span', () => {
        render(<ColoredMarkdown>{':color[red]{color=red} and :color[blue]{color=blue}.'}</ColoredMarkdown>);
        expect(screen.getByText('red')).toHaveStyle({ color: 'rgb(255, 0, 0)' });
        expect(screen.getByText('blue')).toHaveStyle({ color: 'rgb(0, 0, 255)' });
    });

    test('an unsafe color value renders as plain text, not a colored span, and not broken markup', () => {
        render(<ColoredMarkdown>{'Before :color[danger]{color="rgb(255,0,0)"} after.'}</ColoredMarkdown>);
        expect(screen.queryByText(':color', { exact: false })).not.toBeInTheDocument();
        expect(screen.getByText('danger')).toBeInTheDocument();
        expect(screen.getByText('danger')).not.toHaveAttribute('style');
    });

    test('a color directive inside a list item is left as plain text - splicing into a list is not safe with a regex split', () => {
        const { container } = render(<ColoredMarkdown>{'- an item with :color[danger]{color=red} in it'}</ColoredMarkdown>);
        expect(container.querySelector('li')).toHaveTextContent('an item with danger in it');
        expect(container.querySelector('span[style]')).not.toBeInTheDocument();
    });

    test('multiple blocks (blank-line separated) each render their own paragraph, color applied only where present', () => {
        const { container } = render(<ColoredMarkdown>{'Plain paragraph.\n\nA :color[colored]{color=red} one.'}</ColoredMarkdown>);
        const paragraphs = container.querySelectorAll('p');
        expect(paragraphs).toHaveLength(2);
        expect(paragraphs[0]).toHaveTextContent('Plain paragraph.');
        expect(paragraphs[1]).toHaveTextContent('A colored one.');
        expect(screen.getByText('colored')).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    });

    test('non-string children (e.g. empty/undefined) render without crashing', () => {
        const { container } = render(<ColoredMarkdown>{''}</ColoredMarkdown>);
        expect(container).toBeInTheDocument();
    });
});
