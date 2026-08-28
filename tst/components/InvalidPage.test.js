import { render, screen } from '@testing-library/react';
import { InvalidPage } from '../../src/components/InvalidPage';

describe('InvalidPage', () => {
    test('renders the 404 message', () => {
        render(<InvalidPage />);
        expect(screen.getByText('404 Not Found')).toBeInTheDocument();
        expect(screen.getByText(/page you are looking for is not here/i)).toBeInTheDocument();
    });

    test('sets the document title', () => {
        document.title = 'something else';
        render(<InvalidPage />);
        expect(document.title).toBe('404 Invalid Page');
    });
});
