// eslint-disable-next-line import/first
import { render, screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/first
import { FieldError, ValidationSummary, invalidClass, invalidProps, scrollToProblem } from '../../src/components/FormErrors';

let scrolled;
beforeEach(() => {
    scrolled = [];
    window.HTMLElement.prototype.scrollIntoView = function () { scrolled.push(this.getAttribute('data-problem')); };
});

describe('invalidProps / invalidClass', () => {
    test('add aria-invalid, the data-problem marker and the red class only when there is a message', () => {
        expect(invalidProps('field-x', 'Nope')).toEqual({ 'aria-invalid': true, 'data-problem': 'field-x' });
        expect(invalidProps('field-x', undefined)).toEqual({});
        expect(invalidClass('a b', 'Nope')).toBe('a b ClassPage-field-input-invalid');
        expect(invalidClass('a b', undefined)).toBe('a b');
    });
});

describe('FieldError', () => {
    test('shows its message as an alert, and nothing without one', () => {
        const { rerender } = render(<FieldError message="Enter a number."/>);
        expect(screen.getByRole('alert')).toHaveTextContent('Enter a number.');
        rerender(<FieldError message={undefined}/>);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});

describe('scrollToProblem', () => {
    function page() {
        return render(<div>
            <input data-problem="field-a" aria-label="A"/>
            <input data-problem="action-2-actionCost" aria-label="Cost"/>
        </div>);
    }

    test('with no id it goes to the first problem on the page and focuses it', () => {
        page();
        scrollToProblem();
        expect(scrolled).toEqual(['field-a']);
        expect(screen.getByLabelText('A')).toHaveFocus();
    });

    test('with an id it goes to that problem', () => {
        page();
        scrollToProblem('action-2-actionCost');
        expect(scrolled).toEqual(['action-2-actionCost']);
        expect(screen.getByLabelText('Cost')).toHaveFocus();
    });

    test('scrolls smoothly, unless the account setting or the operating system asks for reduced motion', () => {
        const behaviors = [];
        window.HTMLElement.prototype.scrollIntoView = function (options) { behaviors.push(options.behavior); };
        window.matchMedia = () => ({ matches: false });
        page();

        scrollToProblem();
        document.documentElement.classList.add('A11y-reduce-motion');
        scrollToProblem();
        document.documentElement.classList.remove('A11y-reduce-motion');
        window.matchMedia = query => ({ matches: query === '(prefers-reduced-motion: reduce)' });
        scrollToProblem();

        expect(behaviors).toEqual(['smooth', 'auto', 'auto']);
        delete window.matchMedia;
    });

    test('an id that is no longer on the page (already fixed) is quietly ignored', () => {
        page();
        expect(() => scrollToProblem('gone')).not.toThrow();
        expect(scrolled).toEqual([]);
    });
});

describe('ValidationSummary', () => {
    const problems = [
        { id: 'field-a', label: 'Class name', message: 'Give the class a name.' },
        { id: 'action-2-actionCost', label: 'Action "Stab" - cost', message: 'Cost must be a whole number from 0 to 3.' },
    ];

    test('renders nothing when there are no problems', () => {
        const { container } = render(<ValidationSummary problems={[]}/>);
        expect(container).toBeEmptyDOMElement();
    });

    test('counts and lists every problem with its label and message', () => {
        render(<ValidationSummary problems={problems}/>);
        expect(screen.getByText('2 things to fix before saving')).toBeInTheDocument();
        expect(screen.getByText('Class name')).toBeInTheDocument();
        expect(screen.getByText('Cost must be a whole number from 0 to 3.')).toBeInTheDocument();
    });

    test('uses the singular for one problem', () => {
        render(<ValidationSummary problems={[problems[0]]}/>);
        expect(screen.getByText('1 thing to fix before saving')).toBeInTheDocument();
    });

    test('clicking a problem scrolls to its field', () => {
        render(<div>
            <input data-problem="field-a" aria-label="A"/>
            <input data-problem="action-2-actionCost" aria-label="Cost"/>
            <ValidationSummary problems={problems}/>
        </div>);

        fireEvent.click(screen.getByRole('button', { name: /Action "Stab" - cost/ }));

        expect(scrolled).toEqual(['action-2-actionCost']);
        expect(screen.getByLabelText('Cost')).toHaveFocus();
    });
});
