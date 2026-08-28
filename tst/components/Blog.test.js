import { screen } from '@testing-library/react';
import { Blog } from '../../src/components/Blog';
import { renderWithRouter } from '../testUtils/renderWithRouter';

describe('Blog', () => {
    test('sets the document title', () => {
        document.title = 'something else';
        renderWithRouter(<Blog markdowns={[]} />);
        expect(document.title).toBe('Blog');
    });

    test('renders one link per markdown file, pointing at /blog/<filename>', () => {
        renderWithRouter(<Blog markdowns={['Rules', 'Homebrew']} />);

        const rulesLink = screen.getByRole('link', { name: 'Rules' });
        expect(rulesLink).toHaveAttribute('href', '/blog/Rules');

        const homebrewLink = screen.getByRole('link', { name: 'Homebrew' });
        expect(homebrewLink).toHaveAttribute('href', '/blog/Homebrew');
    });

    test('renders no links when markdowns is empty', () => {
        renderWithRouter(<Blog markdowns={[]} />);
        expect(screen.queryAllByRole('link')).toHaveLength(0);
    });

    test('does not throw when markdowns is undefined (optional chaining)', () => {
        expect(() => renderWithRouter(<Blog />)).not.toThrow();
        expect(screen.queryAllByRole('link')).toHaveLength(0);
    });
});
