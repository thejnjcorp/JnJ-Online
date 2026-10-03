import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarDatePicker, CalendarSync, EndSceneCard, MoveCalendarOption, endAsksAboutCalendar } from '../../src/components/SceneCalendarParts';
import { defaultCalendar } from '../../src/utils/calendar';

const calendar = { ...defaultCalendar(), today: { year: 2, month: 5, day: 10 } };
const scene = (fields = {}) => ({ id: 's', name: 'Fire', premise: 'Burns', date: { year: 2, month: 11, day: 21 }, ...fields });

describe('CalendarDatePicker', () => {
    test('with no date says so, and sets one to the calendar\'s today', () => {
        const onChange = jest.fn();
        render(<CalendarDatePicker calendar={calendar} value={null} onChange={onChange}/>);
        expect(screen.getByText('No date')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Set a date' }));
        expect(onChange).toHaveBeenCalledWith({ year: 2, month: 5, day: 10 });
    });

    test('a date is a day, a month and a year, any of which can change', () => {
        const onChange = jest.fn();
        render(<CalendarDatePicker calendar={calendar} value={{ year: 2, month: 11, day: 21 }} onChange={onChange}/>);
        expect(screen.getByLabelText('In-world date, month')).toHaveValue('11');
        fireEvent.change(screen.getByLabelText('In-world date, day'), { target: { value: '5' } });
        expect(onChange).toHaveBeenLastCalledWith({ year: 2, month: 11, day: 5 });
        fireEvent.change(screen.getByLabelText('In-world date, year'), { target: { value: '7' } });
        expect(onChange).toHaveBeenLastCalledWith({ year: 7, month: 11, day: 21 });
        fireEvent.change(screen.getByLabelText('In-world date, month'), { target: { value: '3' } });
        expect(onChange).toHaveBeenLastCalledWith({ year: 2, month: 3, day: 21 });
    });

    test('a day the month does not have is brought back to its last, and so is one under 1', () => {
        const onChange = jest.fn();
        render(<CalendarDatePicker calendar={calendar} value={{ year: 2, month: 1, day: 10 }} onChange={onChange}/>);
        fireEvent.change(screen.getByLabelText('In-world date, day'), { target: { value: '31' } });
        expect(onChange).toHaveBeenLastCalledWith({ year: 2, month: 1, day: 28 });
        fireEvent.change(screen.getByLabelText('In-world date, day'), { target: { value: '0' } });
        expect(onChange).toHaveBeenLastCalledWith({ year: 2, month: 1, day: 1 });
    });

    test('changing to a shorter month keeps the day inside it, and the date can go back to the calendar\'s today or to none', () => {
        const onChange = jest.fn();
        render(<CalendarDatePicker calendar={calendar} value={{ year: 2, month: 0, day: 31 }} onChange={onChange}/>);
        fireEvent.change(screen.getByLabelText('In-world date, month'), { target: { value: '1' } });
        expect(onChange).toHaveBeenLastCalledWith({ year: 2, month: 1, day: 28 });
        fireEvent.click(screen.getByRole('button', { name: "Calendar's today" }));
        expect(onChange).toHaveBeenLastCalledWith({ year: 2, month: 5, day: 10 });
        fireEvent.click(screen.getByRole('button', { name: 'No date' }));
        expect(onChange).toHaveBeenLastCalledWith(null);
    });
});

describe('MoveCalendarOption', () => {
    test('says where the calendar is and where it would go, and can be ticked off', () => {
        const onChange = jest.fn();
        render(<MoveCalendarOption scene={scene()} calendar={calendar} checked onChange={onChange}/>);
        const box = screen.getByRole('checkbox', { name: 'Move the calendar to 21 December, year 2 (it says 10 June, year 2)' });
        fireEvent.click(box);
        expect(onChange).toHaveBeenCalledWith(false);
    });

    test('is not there for a scene with no date or on the calendar\'s day', () => {
        const { container, rerender } = render(<MoveCalendarOption scene={scene({ date: null })} calendar={calendar} checked onChange={jest.fn()}/>);
        expect(container).toBeEmptyDOMElement();
        rerender(<MoveCalendarOption scene={scene({ date: calendar.today })} calendar={calendar} checked onChange={jest.fn()}/>);
        expect(container).toBeEmptyDOMElement();
    });
});

describe('CalendarSync', () => {
    test('sets the calendar to the scene\'s day', async () => {
        const onSync = jest.fn().mockResolvedValue(undefined);
        render(<CalendarSync scene={scene()} calendar={calendar} onSync={onSync}/>);
        fireEvent.click(screen.getByRole('button', { name: 'Set calendar to 21 December, year 2' }));
        expect(onSync).toHaveBeenCalledWith({ year: 2, month: 11, day: 21 });
        await screen.findByRole('button', { name: /Set calendar to/ });
    });

    test('is not there when the calendar is on that day already', () => {
        const { container } = render(<CalendarSync scene={scene({ date: calendar.today })} calendar={calendar} onSync={jest.fn()}/>);
        expect(container).toBeEmptyDOMElement();
    });
});

describe('ending a scene', () => {
    test('asks only for a scene with a day that has not been put on the calendar', () => {
        expect(endAsksAboutCalendar(scene(), calendar)).toBe(true);
        expect(endAsksAboutCalendar(scene({ calendarEventId: 'e' }), calendar)).toBe(false);
        expect(endAsksAboutCalendar(scene({ date: null }), calendar)).toBe(false);
    });

    test('the card ends it with or without the log, or lets it keep running', () => {
        const onEnd = jest.fn();
        const onCancel = jest.fn();
        render(<EndSceneCard scene={scene()} calendar={calendar} onEnd={onEnd} onCancel={onCancel}/>);
        fireEvent.click(screen.getByRole('button', { name: 'End scene' }));
        expect(onEnd).toHaveBeenLastCalledWith({ logOnCalendar: true });
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: 'End scene' }));
        expect(onEnd).toHaveBeenLastCalledWith({ logOnCalendar: false });
        fireEvent.click(screen.getByRole('button', { name: 'Keep running' }));
        expect(onCancel).toHaveBeenCalled();
    });
});
