/* eslint-disable testing-library/no-container, testing-library/no-node-access --
   these tests check inline style values on plain, non-interactive layout
   wrapper divs (.TabContainer / .TabContainer-content) - there's no
   accessible role/text to query them by, so container access is the only way. */
import { render, screen, fireEvent } from '@testing-library/react';
import { TabContainer } from '../../src/components/TabContainer';

const tabs = [
    { tabName: 'Roleplay', icon: <span>R-icon</span>, content: <div>Roleplay content</div> },
    { tabName: 'Combat', icon: <span>C-icon</span>, content: <div>Combat content</div> },
];

describe('TabContainer', () => {
    test('renders a button per tab and starts with the first tab active', () => {
        render(<TabContainer tabs={tabs} />);

        expect(screen.getByRole('button', { name: /Roleplay/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Combat/ })).toBeInTheDocument();
        expect(screen.getByText('Roleplay content')).toBeInTheDocument();
        expect(screen.queryByText('Combat content')).not.toBeInTheDocument();
    });

    test('clicking a tab button switches the active content', () => {
        render(<TabContainer tabs={tabs} />);

        fireEvent.click(screen.getByRole('button', { name: /Combat/ }));

        expect(screen.getByText('Combat content')).toBeInTheDocument();
        expect(screen.queryByText('Roleplay content')).not.toBeInTheDocument();
    });

    test('the selected tab button gets the TabButtonSelected class, the other does not', () => {
        render(<TabContainer tabs={tabs} />);

        expect(screen.getByRole('button', { name: /Roleplay/ }).className).toContain('TabButtonSelected');
        expect(screen.getByRole('button', { name: /Combat/ }).className).not.toContain('TabButtonSelected');

        fireEvent.click(screen.getByRole('button', { name: /Combat/ }));

        expect(screen.getByRole('button', { name: /Combat/ }).className).toContain('TabButtonSelected');
        expect(screen.getByRole('button', { name: /Roleplay/ }).className).not.toContain('TabButtonSelected');
    });

    test('container_height sets a maxHeight on the outer container', () => {
        const { container } = render(<TabContainer tabs={tabs} container_height="90vh" />);
        expect(container.querySelector('.TabContainer')).toHaveStyle({ maxHeight: '90vh' });
    });

    test('content_height sets a maxHeight on the content area when the active tab has no per-tab contentHeight', () => {
        const { container } = render(<TabContainer tabs={tabs} content_height="80vh" />);
        expect(container.querySelector('.TabContainer-content')).toHaveStyle({ maxHeight: '80vh' });
    });

    test('a per-tab contentHeight takes precedence over content_height, and sets a definite height (not just a cap)', () => {
        const tabsWithHeight = [
            { tabName: 'Map', icon: null, content: <div>Map content</div>, contentHeight: '500px' },
        ];
        const { container } = render(<TabContainer tabs={tabsWithHeight} content_height="80vh" />);
        expect(container.querySelector('.TabContainer-content')).toHaveStyle({ height: '500px', maxHeight: '500px' });
    });

    test('with neither container_height nor content_height, no inline height styles are applied', () => {
        const { container } = render(<TabContainer tabs={tabs} />);
        expect(container.querySelector('.TabContainer').style.maxHeight).toBe('');
        expect(container.querySelector('.TabContainer-content').style.maxHeight).toBe('');
    });
});
