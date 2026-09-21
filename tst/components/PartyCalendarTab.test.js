const mockUpdateParty = jest.fn();
jest.mock('../../src/utils/party', () => ({ updateParty: (...args) => mockUpdateParty(...args) }));
const mockEvents = { events: [], status: 'ready', addEvent: jest.fn(), saveEvent: jest.fn(), deleteEvent: jest.fn() };
const mockUsePartyEvents = jest.fn();
jest.mock('../../src/utils/usePartyEvents', () => ({ usePartyEvents: (...args) => mockUsePartyEvents(...args) }));

// eslint-disable-next-line import/first
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { PartyCalendarTab } from '../../src/components/PartyCalendarTab';
// eslint-disable-next-line import/first
import { defaultCalendar } from '../../src/utils/calendar';

// a small world - three months of ten days, a five-day week - so the dates in the tests are easy to follow
const small = { weekdays: ['Aa', 'Bb', 'Cc', 'Dd', 'Ee'], months: [{ name: 'Frost', days: 10 }, { name: 'Bloom', days: 10 }, { name: 'Harvest', days: 10 }], today: { year: 3, month: 1, day: 4 } };
const event = (id, title, year, month, day, extra = {}) => ({ id, title, description: '', category: '', year, month, day, ...extra });

function draw({ party = { calendar: small }, isDirector = false, events = [], status = 'ready' } = {}) {
    Object.assign(mockEvents, { events, status });
    mockUsePartyEvents.mockReturnValue(mockEvents);
    return render(<PartyCalendarTab campaignId="camp-1" party={party} isDirector={isDirector}/>);
}
const day = label => within(screen.getByRole('table')).getByRole('button', { name: new RegExp(`^${label}`) });

beforeEach(() => {
    mockUpdateParty.mockResolvedValue(undefined);
    ['addEvent', 'saveEvent', 'deleteEvent'].forEach(name => mockEvents[name].mockResolvedValue(undefined));
    window.confirm = jest.fn(() => true);
});

afterEach(() => {
    delete window.confirm;
});

describe('PartyCalendarTab', () => {
    describe('the calendar', () => {
        test('opens on the month it is in the game, and says what day it is', () => {
            draw();
            expect(screen.getByRole('heading', { name: 'Bloom, year 3' })).toBeInTheDocument();
            expect(screen.getByText('4 Bloom, year 3', { selector: 'strong' })).toBeInTheDocument();
        });

        test('the weekdays head the columns and every day of the month is there once', () => {
            draw();
            expect(screen.getAllByRole('columnheader').map(header => header.textContent)).toEqual(['Aa', 'Bb', 'Cc', 'Dd', 'Ee']);
                        expect(within(screen.getByRole('table')).getAllByRole('button')).toHaveLength(10);
        });

        test('today is marked, and is the day picked to begin with', () => {
            draw();
            expect(day('4 Bloom, year 3')).toHaveAttribute('aria-label', '4 Bloom, year 3, today');
            expect(day('4 Bloom, year 3')).toHaveAttribute('aria-pressed', 'true');
            expect(day('5 Bloom, year 3')).toHaveAttribute('aria-pressed', 'false');
        });

        test('uses the ordinary calendar when the party has not set one up', () => {
            draw({ party: {} });
            expect(screen.getByRole('heading', { name: 'January, year 1' })).toBeInTheDocument();
            expect(screen.getAllByRole('columnheader')).toHaveLength(7);
        });

        test('goes back and forward a month, rolling the year over', () => {
            draw();
            fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
            expect(screen.getByRole('heading', { name: 'Harvest, year 3' })).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
            expect(screen.getByRole('heading', { name: 'Frost, year 4' })).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
            fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
            fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
            expect(screen.getByRole('heading', { name: 'Frost, year 3' })).toBeInTheDocument();
        });

        test('Back to today returns to the month it is now, with today picked', () => {
            draw();
            fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
            fireEvent.click(screen.getByRole('button', { name: 'Back to today' }));
            expect(screen.getByRole('heading', { name: 'Bloom, year 3' })).toBeInTheDocument();
            expect(day('4 Bloom, year 3')).toHaveAttribute('aria-pressed', 'true');
        });

        test('shows what happened on each day, and how many events there are', () => {
            draw({ events: [event('a', 'Reached the gate', 3, 1, 6), event('b', 'Met a stranger', 3, 1, 6), event('c', 'Bought horses', 3, 1, 6)] });
            const busy = day('6 Bloom, year 3');
            expect(busy).toHaveAttribute('aria-label', '6 Bloom, year 3, 3 events');
            expect(within(busy).getByText('Reached the gate')).toBeInTheDocument();
            expect(within(busy).getByText('+1 more')).toBeInTheDocument();
            expect(day('7 Bloom, year 3')).toHaveAttribute('aria-label', '7 Bloom, year 3');
        });

        test('a day with one event says so in the singular', () => {
            draw({ events: [event('a', 'Reached the gate', 3, 1, 6)] });
            expect(day('6 Bloom, year 3')).toHaveAttribute('aria-label', '6 Bloom, year 3, 1 event');
        });
    });

    describe('moving today', () => {
        test('Next day moves the game on a day, for everyone', () => {
            draw();
            fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
            const change = mockUpdateParty.mock.calls[0][1];
            expect(mockUpdateParty).toHaveBeenCalledWith('camp-1', expect.any(Function));
            expect(change({}).calendar.today).toEqual({ year: 3, month: 1, day: 5 });
        });

        test('Next day rolls over the end of a month and year', () => {
            draw({ party: { calendar: { ...small, today: { year: 3, month: 2, day: 10 } } } });
            fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
            expect(mockUpdateParty.mock.calls[0][1]({}).calendar.today).toEqual({ year: 4, month: 0, day: 1 });
        });

        test('any day picked can be made today', () => {
            draw();
            fireEvent.click(day('8 Bloom, year 3'));
            fireEvent.click(screen.getByRole('button', { name: 'Make 8 Bloom, year 3 today' }));
            expect(mockUpdateParty.mock.calls[0][1]({}).calendar.today).toEqual({ year: 3, month: 1, day: 8 });
        });

        test('today cannot be made today again', () => {
            draw();
            expect(screen.getByRole('button', { name: 'Make 4 Bloom, year 3 today' })).toBeDisabled();
        });

        test('keeps the rest of the calendar as it was', () => {
            draw();
            fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
            const saved = mockUpdateParty.mock.calls[0][1]({}).calendar;
            expect(saved.months).toEqual(small.months);
            expect(saved.weekdays).toEqual(small.weekdays);
        });

        test('a refusal is shown', async () => {
            mockUpdateParty.mockRejectedValue(new Error('offline'));
            draw();
            fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
            expect(await screen.findByRole('alert')).toHaveTextContent('offline');
        });
    });

    describe('a day\'s events', () => {
        test('the picked day\'s events are listed with what happened, the kind, and who added them', () => {
            draw({ events: [event('a', 'Reached the gate', 3, 1, 4, { description: 'It was locked.', category: 'travel', created_by_name: 'Sam' })] });
            const panel = within(screen.getByRole('region', { name: 'Events on 4 Bloom, year 3' }));
            expect(panel.getByText('Reached the gate')).toBeInTheDocument();
            expect(panel.getByText('It was locked.')).toBeInTheDocument();
            expect(panel.getByText('travel')).toBeInTheDocument();
            expect(panel.getByText('Added by Sam')).toBeInTheDocument();
        });

        test('picking another day shows that day\'s', () => {
            draw({ events: [event('a', 'Reached the gate', 3, 1, 4), event('b', 'Bought horses', 3, 1, 7)] });
            fireEvent.click(day('7 Bloom, year 3'));
            const panel = within(screen.getByRole('region', { name: 'Events on 7 Bloom, year 3' }));
            expect(panel.getByText('Bought horses')).toBeInTheDocument();
            expect(panel.queryByText('Reached the gate')).not.toBeInTheDocument();
        });

        test('says when a day has nothing, while events load, and when they cannot', () => {
            const { unmount } = draw();
            expect(screen.getByText('Nothing recorded for this day.')).toBeInTheDocument();
            unmount();
            draw({ status: 'loading' });
            expect(screen.getByText('Loading events…')).toBeInTheDocument();
        });

        test('says when the events could not load', () => {
            draw({ status: 'error' });
            expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load the calendar's events.");
        });

        describe('adding one', () => {
            const openForm = () => fireEvent.click(screen.getByRole('button', { name: 'Add an event' }));

            test('starts on the day that is picked', () => {
                draw();
                fireEvent.click(day('8 Bloom, year 3'));
                openForm();
                expect(screen.getByLabelText('Event day')).toHaveValue(8);
                expect(screen.getByLabelText('Event month')).toHaveValue('1');
                expect(screen.getByLabelText('Event year')).toHaveValue(3);
            });

            test('saves the event, tidied, and closes the form', async () => {
                draw();
                openForm();
                fireEvent.change(screen.getByLabelText('Event title'), { target: { value: '  Reached the gate ' } });
                fireEvent.change(screen.getByLabelText('Event category'), { target: { value: ' travel ' } });
                fireEvent.change(screen.getByLabelText('Event details'), { target: { value: 'It was locked.' } });
                fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
                await waitFor(() => expect(mockEvents.addEvent).toHaveBeenCalledWith({ title: 'Reached the gate', description: 'It was locked.', category: 'travel', year: 3, month: 1, day: 4 }));
                await waitFor(() => expect(screen.queryByRole('form', { name: 'Add an event' })).not.toBeInTheDocument());
            });

            test('can be on any date, not only the day picked', async () => {
                draw();
                openForm();
                fireEvent.change(screen.getByLabelText('Event title'), { target: { value: 'Left home' } });
                fireEvent.change(screen.getByLabelText('Event day'), { target: { value: '2' } });
                fireEvent.change(screen.getByLabelText('Event month'), { target: { value: '0' } });
                fireEvent.change(screen.getByLabelText('Event year'), { target: { value: '1' } });
                fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
                await waitFor(() => expect(mockEvents.addEvent).toHaveBeenCalledWith(expect.objectContaining({ year: 1, month: 0, day: 2 })));
            });

            test('needs a title, and a real date', () => {
                draw();
                openForm();
                fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
                expect(screen.getByRole('alert')).toHaveTextContent('Give the event a title.');
                fireEvent.change(screen.getByLabelText('Event title'), { target: { value: 'x' } });
                fireEvent.change(screen.getByLabelText('Event day'), { target: { value: '11' } });
                fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
                expect(screen.getByRole('alert')).toHaveTextContent('not in this calendar');
                expect(mockEvents.addEvent).not.toHaveBeenCalled();
            });

            test('can be cancelled', () => {
                draw();
                openForm();
                fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
                expect(screen.queryByLabelText('Event title')).not.toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Add an event' })).toBeInTheDocument();
            });

            test('a failure to save is shown, and the form stays', async () => {
                mockEvents.addEvent.mockRejectedValue(new Error('permission-denied'));
                draw();
                openForm();
                fireEvent.change(screen.getByLabelText('Event title'), { target: { value: 'x' } });
                fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
                expect(await screen.findByRole('alert')).toHaveTextContent('permission-denied');
                expect(screen.getByLabelText('Event title')).toBeInTheDocument();
            });
        });

        describe('changing and deleting', () => {
            const one = () => draw({ events: [event('a', 'Reached the gate', 3, 1, 4, { description: 'Locked.', category: 'travel' })] });

            test('Change opens the event in a form, and saves what is changed', async () => {
                one();
                fireEvent.click(screen.getByRole('button', { name: 'Change Reached the gate' }));
                expect(screen.getByLabelText('Event title')).toHaveValue('Reached the gate');
                expect(screen.getByLabelText('Event details')).toHaveValue('Locked.');
                fireEvent.change(screen.getByLabelText('Event title'), { target: { value: 'Broke the gate' } });
                fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
                await waitFor(() => expect(mockEvents.saveEvent).toHaveBeenCalledWith('a', { title: 'Broke the gate', description: 'Locked.', category: 'travel', year: 3, month: 1, day: 4 }));
            });

            test('changing can be cancelled', () => {
                one();
                fireEvent.click(screen.getByRole('button', { name: 'Change Reached the gate' }));
                fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
                expect(within(screen.getByRole('region', { name: 'Events on 4 Bloom, year 3' })).getByText('Reached the gate')).toBeInTheDocument();
                expect(mockEvents.saveEvent).not.toHaveBeenCalled();
            });

            test('Delete asks first', () => {
                one();
                fireEvent.click(screen.getByRole('button', { name: 'Delete Reached the gate' }));
                expect(window.confirm).toHaveBeenCalledWith('Delete "Reached the gate"?');
                expect(mockEvents.deleteEvent).toHaveBeenCalledWith('a');
            });

            test('declining the delete keeps the event', () => {
                window.confirm = jest.fn(() => false);
                one();
                fireEvent.click(screen.getByRole('button', { name: 'Delete Reached the gate' }));
                expect(mockEvents.deleteEvent).not.toHaveBeenCalled();
            });
        });
    });

    describe('everything that has happened', () => {
        test('lists every event, in order, with its date', () => {
            draw({ events: [event('a', 'Left home', 2, 0, 3), event('b', 'Reached the gate', 3, 1, 4, { category: 'travel' })] });
            const list = within(screen.getByRole('region', { name: 'Everything that has happened' }));
            const items = list.getAllByRole('listitem');
            expect(items[0]).toHaveTextContent('3 Frost, year 2Left home');
            expect(items[1]).toHaveTextContent('4 Bloom, year 3Reached the gatetravel');
        });

        test('pressing a date jumps to that day', () => {
            draw({ events: [event('a', 'Left home', 2, 0, 3)] });
            fireEvent.click(screen.getByRole('button', { name: '3 Frost, year 2' }));
            expect(screen.getByRole('heading', { name: 'Frost, year 2' })).toBeInTheDocument();
            expect(within(screen.getByRole('region', { name: 'Events on 3 Frost, year 2' })).getByText('Left home')).toBeInTheDocument();
        });

        test('an event on a date the calendar no longer has is listed but cannot be jumped to', () => {
            draw({ events: [event('a', 'Lost to a reshaped year', 3, 7, 3)] });
            expect(screen.getByRole('button', { name: 'A date that is no longer in the calendar' })).toBeDisabled();
        });

        test('says when there are none', () => {
            draw();
            expect(screen.getByText('No events yet. Pick a day above and add the first.')).toBeInTheDocument();
        });
    });

    describe('setting up the calendar', () => {
        const openSetup = () => fireEvent.click(screen.getByRole('button', { name: 'Set up the calendar' }));

        test('only a director is offered it', () => {
            draw();
            expect(screen.queryByRole('button', { name: 'Set up the calendar' })).not.toBeInTheDocument();
        });

        test('shows the weekdays, the months and today, as they are', () => {
            draw({ isDirector: true });
            openSetup();
            expect(screen.getByLabelText('Weekday 1')).toHaveValue('Aa');
            expect(screen.getByLabelText('Month 2 name')).toHaveValue('Bloom');
            expect(screen.getByLabelText('Month 2 days')).toHaveValue(10);
            expect(screen.getByLabelText("Today's day")).toHaveValue(4);
        });

        test('saves what is changed, to the party doc', async () => {
            draw({ isDirector: true });
            openSetup();
            fireEvent.change(screen.getByLabelText('Month 1 name'), { target: { value: 'Deepfrost' } });
            fireEvent.change(screen.getByLabelText('Month 1 days'), { target: { value: '12' } });
            fireEvent.click(screen.getByRole('button', { name: 'Save calendar' }));
            await waitFor(() => expect(mockUpdateParty).toHaveBeenCalled());
            const saved = mockUpdateParty.mock.calls[0][1]({}).calendar;
            expect(saved.months[0]).toEqual({ name: 'Deepfrost', days: 12 });
            expect(saved.months).toHaveLength(3);
            await waitFor(() => expect(screen.queryByRole('region', { name: 'Calendar settings' })).not.toBeInTheDocument());
        });

        test('months and weekdays can be added and removed', async () => {
            draw({ isDirector: true });
            openSetup();
            fireEvent.click(screen.getByRole('button', { name: '+ Add a month' }));
            fireEvent.click(screen.getByRole('button', { name: '+ Add a weekday' }));
            fireEvent.click(screen.getByRole('button', { name: 'Remove month 1' }));
            fireEvent.click(screen.getByRole('button', { name: 'Remove weekday 1' }));
            fireEvent.click(screen.getByRole('button', { name: 'Save calendar' }));
            await waitFor(() => expect(mockUpdateParty).toHaveBeenCalled());
            const saved = mockUpdateParty.mock.calls[0][1]({}).calendar;
            expect(saved.months.map(m => m.name)).toEqual(['Bloom', 'Harvest', 'Month 4']);
            expect(saved.weekdays).toEqual(['Bb', 'Cc', 'Dd', 'Ee', 'Day 6']);
        });

        test('cannot remove the last month or the last weekday', () => {
            draw({ party: { calendar: { weekdays: ['Only'], months: [{ name: 'One', days: 5 }], today: { year: 0, month: 0, day: 1 } } }, isDirector: true });
            openSetup();
            expect(screen.getByRole('button', { name: 'Remove month 1' })).toBeDisabled();
            expect(screen.getByRole('button', { name: 'Remove weekday 1' })).toBeDisabled();
        });

        test('is not saved while it has problems, which are listed', () => {
            draw({ isDirector: true });
            openSetup();
            fireEvent.change(screen.getByLabelText('Month 1 days'), { target: { value: '0' } });
            fireEvent.change(screen.getByLabelText('Weekday 2'), { target: { value: '' } });
            fireEvent.click(screen.getByRole('button', { name: 'Save calendar' }));
            expect(screen.getByRole('alert')).toHaveTextContent('weekday needs a name');
            expect(screen.getByRole('alert')).toHaveTextContent('1 to 100 days');
            expect(mockUpdateParty).not.toHaveBeenCalled();
        });

        test('today has to be a real date in the calendar', () => {
            draw({ isDirector: true });
            openSetup();
            fireEvent.change(screen.getByLabelText("Today's day"), { target: { value: '31' } });
            fireEvent.click(screen.getByRole('button', { name: 'Save calendar' }));
            expect(screen.getByRole('alert')).toHaveTextContent('Today is not a date in this calendar.');
        });

        test('can be cancelled, changing nothing', () => {
            draw({ isDirector: true });
            openSetup();
            fireEvent.change(screen.getByLabelText('Month 1 name'), { target: { value: 'Changed' } });
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(screen.queryByRole('region', { name: 'Calendar settings' })).not.toBeInTheDocument();
            expect(mockUpdateParty).not.toHaveBeenCalled();
        });

        test('a failure to save is shown, and the setup stays open', async () => {
            mockUpdateParty.mockRejectedValue(new Error('permission-denied'));
            draw({ isDirector: true });
            openSetup();
            fireEvent.click(screen.getByRole('button', { name: 'Save calendar' }));
            expect(await screen.findByRole('alert')).toHaveTextContent('permission-denied');
            expect(screen.getByRole('region', { name: 'Calendar settings' })).toBeInTheDocument();
        });

        test('the ordinary calendar can be set up from too', () => {
            draw({ party: {}, isDirector: true });
            openSetup();
            expect(screen.getByLabelText('Month 12 name')).toHaveValue('December');
            expect(defaultCalendar().months).toHaveLength(12);
        });
    });
});
