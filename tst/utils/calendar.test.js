import {
    addDays, calendarOf, compareDates, dateFromDayNumber, dayNumber, daysBetween, defaultCalendar, eventDate, eventDocFields, eventsOnDate,
    formatDate, formatMonth, isValidDate, monthGrid, sameDate, shiftMonth, sortEvents, validateCalendar, validateEvent, weekdayOf, yearLength,
    MAX_EVENT_TITLE, MAX_MONTHS, MAX_MONTH_DAYS, MAX_NAME_LENGTH, MAX_WEEKDAYS,
} from '../../src/utils/calendar';

const standard = defaultCalendar();
// a small world: 3 months of 10 days (a year of 30), a 5-day week
const small = { weekdays: ['a', 'b', 'c', 'd', 'e'], months: [{ name: 'One', days: 10 }, { name: 'Two', days: 10 }, { name: 'Three', days: 10 }], today: { year: 0, month: 0, day: 1 } };

describe('the ordinary calendar', () => {
    test('has twelve months, seven weekdays, and today on the first day of year 1', () => {
        expect(standard.months).toHaveLength(12);
        expect(standard.weekdays).toHaveLength(7);
        expect(standard.today).toEqual({ year: 1, month: 0, day: 1 });
        expect(yearLength(standard)).toBe(365);
    });

    test('is valid', () => {
        expect(validateCalendar(standard)).toEqual({ valid: true, problems: [] });
    });

    test('is a fresh one each time, so editing it never changes the next', () => {
        const one = defaultCalendar();
        one.months[0].days = 1;
        expect(defaultCalendar().months[0].days).toBe(31);
    });
});

describe('calendarOf', () => {
    test('is the party\'s calendar when it has a usable one', () => {
        expect(calendarOf({ calendar: small })).toBe(small);
    });

    test('is the ordinary one when there is none, or it is broken', () => {
        expect(calendarOf({})).toEqual(standard);
        expect(calendarOf(undefined)).toEqual(standard);
        expect(calendarOf({ calendar: { weekdays: [], months: [] } })).toEqual(standard);
        expect(calendarOf({ calendar: 'junk' })).toEqual(standard);
    });
});

describe('validateCalendar', () => {
    const problems = calendar => validateCalendar(calendar).problems;

    test('a week needs some days, not too many, each named', () => {
        expect(problems({ ...small, weekdays: [] })[0]).toMatch(/week needs/);
        expect(problems({ ...small, weekdays: Array(MAX_WEEKDAYS + 1).fill('x') })[0]).toMatch(/week needs/);
        expect(problems({ ...small, weekdays: ['a', ' '] })[0]).toMatch(/weekday needs a name/);
        expect(problems({ ...small, weekdays: ['x'.repeat(MAX_NAME_LENGTH + 1)] })[0]).toMatch(/weekday needs a name/);
    });

    test('a year needs some months, not too many', () => {
        expect(problems({ ...small, months: [] })[0]).toMatch(/year needs/);
        expect(problems({ ...small, months: Array(MAX_MONTHS + 1).fill({ name: 'x', days: 1 }) })[0]).toMatch(/year needs/);
    });

    test('each month needs a name and a sensible number of days', () => {
        expect(problems({ ...small, months: [{ name: '', days: 5 }] })[0]).toMatch(/month needs a name/);
        expect(problems({ ...small, months: [{ name: 'A', days: 0 }] })[0]).toMatch(/1 to 100 days/);
        expect(problems({ ...small, months: [{ name: 'A', days: MAX_MONTH_DAYS + 1 }] })[0]).toMatch(/days/);
        expect(problems({ ...small, months: [{ name: 'A', days: 2.5 }] })[0]).toMatch(/days/);
    });

    test('today must be a real date in it', () => {
        expect(problems({ ...small, today: { year: 0, month: 0, day: 11 } })).toEqual(['Today is not a date in this calendar.']);
        expect(problems({ ...small, today: undefined })).toEqual(['Today is not a date in this calendar.']);
    });

    test('nothing at all is not a calendar', () => {
        expect(validateCalendar(undefined).valid).toBe(false);
        expect(validateCalendar(null).valid).toBe(false);
    });
});

describe('dates', () => {
    test('a date is in the calendar if its month exists and its day is within the month', () => {
        expect(isValidDate(standard, { year: 5, month: 1, day: 28 })).toBe(true);
        expect(isValidDate(standard, { year: 5, month: 1, day: 29 })).toBe(false);
        expect(isValidDate(standard, { year: 5, month: 12, day: 1 })).toBe(false);
        expect(isValidDate(standard, { year: 5, month: 0, day: 0 })).toBe(false);
        expect(isValidDate(standard, { year: 5.5, month: 0, day: 1 })).toBe(false);
        expect(isValidDate(standard, undefined)).toBe(false);
    });

    test('a year 0 or before is allowed', () => {
        expect(isValidDate(small, { year: 0, month: 0, day: 1 })).toBe(true);
        expect(isValidDate(small, { year: -3, month: 2, day: 10 })).toBe(true);
    });

    test('day numbers count days, and turn back into the same date', () => {
        expect(dayNumber(small, { year: 0, month: 0, day: 1 })).toBe(0);
        expect(dayNumber(small, { year: 0, month: 1, day: 1 })).toBe(10);
        expect(dayNumber(small, { year: 1, month: 0, day: 1 })).toBe(30);
        [{ year: 0, month: 0, day: 1 }, { year: 7, month: 2, day: 10 }, { year: -2, month: 1, day: 5 }].forEach(date => {
            expect(dateFromDayNumber(small, dayNumber(small, date))).toEqual(date);
        });
    });

    test('adding days rolls over months and years, forwards and back', () => {
        expect(addDays(small, { year: 0, month: 0, day: 10 }, 1)).toEqual({ year: 0, month: 1, day: 1 });
        expect(addDays(small, { year: 0, month: 2, day: 10 }, 1)).toEqual({ year: 1, month: 0, day: 1 });
        expect(addDays(small, { year: 1, month: 0, day: 1 }, -1)).toEqual({ year: 0, month: 2, day: 10 });
        expect(addDays(small, { year: 0, month: 0, day: 1 }, 0)).toEqual({ year: 0, month: 0, day: 1 });
        expect(addDays(standard, { year: 1, month: 0, day: 31 }, 1)).toEqual({ year: 1, month: 1, day: 1 });
    });

    test('says how far apart, and which is first', () => {
        const a = { year: 0, month: 0, day: 5 };
        const b = { year: 0, month: 1, day: 5 };
        expect(daysBetween(small, a, b)).toBe(10);
        expect(daysBetween(small, b, a)).toBe(-10);
        expect(compareDates(small, a, b)).toBeLessThan(0);
        expect(compareDates(small, b, a)).toBeGreaterThan(0);
        expect(compareDates(small, a, { ...a })).toBe(0);
    });

    test('sameDate compares the three parts', () => {
        expect(sameDate({ year: 1, month: 2, day: 3 }, { year: 1, month: 2, day: 3 })).toBe(true);
        expect(sameDate({ year: 1, month: 2, day: 3 }, { year: 1, month: 2, day: 4 })).toBe(false);
        expect(sameDate(undefined, { year: 1, month: 2, day: 3 })).toBe(false);
    });

    test('writes a date out', () => {
        expect(formatDate(standard, { year: 5, month: 2, day: 14 })).toBe('14 March, year 5');
        expect(formatMonth(standard, { year: 5, month: 2 })).toBe('March, year 5');
        expect(formatDate(standard, { year: 5, month: 40, day: 1 })).toBe('1 ?, year 5');
    });
});

describe('weekdays', () => {
    test('the weekday cycles through the week, a day at a time', () => {
        const days = Array.from({ length: 12 }, (_, i) => weekdayOf(small, { year: 0, month: 0, day: i % 10 + 1 + (i >= 10 ? 0 : 0) }));
        expect(days.slice(0, 5)).toEqual([0, 1, 2, 3, 4]);
        expect(weekdayOf(small, { year: 0, month: 1, day: 1 })).toBe(0); // day 10: two weeks on
        expect(weekdayOf(small, { year: 0, month: 1, day: 2 })).toBe(1);
    });

    test('a year that is not a whole number of weeks shifts the weekday on', () => {
        const start = weekdayOf(standard, { year: 1, month: 0, day: 1 });
        expect(weekdayOf(standard, { year: 2, month: 0, day: 1 })).toBe((start + 365) % 7);
    });

    test('is never negative, even before year 0', () => {
        const day = weekdayOf(small, { year: -1, month: 0, day: 1 });
        expect(day).toBeGreaterThanOrEqual(0);
        expect(day).toBeLessThan(5);
    });
});

describe('monthGrid', () => {
    test('is rows of a week, each cell a day or a blank', () => {
        const grid = monthGrid(small, 0, 0);
        expect(grid).toEqual([[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]]);
    });

    test('blanks fill the start of the month to the weekday it begins on, and the end of the last week', () => {
        const grid = monthGrid(small, 0, 1); // month Two starts on weekday 0 (day 10): no blanks; check Three
        expect(grid[0][0]).toBe(1);
        const shifted = { ...small, weekdays: ['a', 'b', 'c'] };
        const rows = monthGrid(shifted, 0, 1);
        expect(rows.every(row => row.length === 3)).toBe(true);
        expect(rows.flat().filter(cell => cell !== null)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
    });

    test('a month begins under its weekday', () => {
        const grid = monthGrid(standard, 1, 1);
        const first = weekdayOf(standard, { year: 1, month: 1, day: 1 });
        expect(grid[0][first]).toBe(1);
        expect(grid[0].slice(0, first).every(cell => cell === null)).toBe(true);
    });

    test('has every day of the month once, in order', () => {
        const flat = monthGrid(standard, 3, 1).flat().filter(cell => cell !== null);
        expect(flat).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
    });
});

describe('shiftMonth', () => {
    test('moves forward and back a month', () => {
        expect(shiftMonth(standard, { year: 1, month: 5 }, 1)).toEqual({ year: 1, month: 6 });
        expect(shiftMonth(standard, { year: 1, month: 5 }, -1)).toEqual({ year: 1, month: 4 });
    });

    test('rolls the year over', () => {
        expect(shiftMonth(standard, { year: 1, month: 11 }, 1)).toEqual({ year: 2, month: 0 });
        expect(shiftMonth(standard, { year: 1, month: 0 }, -1)).toEqual({ year: 0, month: 11 });
        expect(shiftMonth(standard, { year: 0, month: 0 }, -1)).toEqual({ year: -1, month: 11 });
        expect(shiftMonth(standard, { year: 1, month: 0 }, 25)).toEqual({ year: 3, month: 1 });
    });
});

describe('events', () => {
    const event = (title, year, month, day, extra = {}) => ({ id: title, title, description: '', category: '', year, month, day, ...extra });

    test('eventDate is the date on it', () => {
        expect(eventDate(event('x', 1, 2, 3))).toEqual({ year: 1, month: 2, day: 3 });
    });

    test('eventsOnDate finds those on a day', () => {
        const events = [event('a', 1, 0, 5), event('b', 1, 0, 6), event('c', 1, 0, 5)];
        expect(eventsOnDate(events, { year: 1, month: 0, day: 5 }).map(e => e.id)).toEqual(['a', 'c']);
        expect(eventsOnDate(events, { year: 2, month: 0, day: 5 })).toEqual([]);
    });

    test('sortEvents puts them in the order they happened, and those on one day by when they were added', () => {
        const at = millis => ({ toMillis: () => millis });
        const sorted = sortEvents(standard, [
            event('late', 1, 5, 1), event('second', 1, 0, 5, { createdAt: at(20) }), event('first', 1, 0, 5, { createdAt: at(10) }), event('early', 0, 11, 30),
        ]);
        expect(sorted.map(e => e.id)).toEqual(['early', 'first', 'second', 'late']);
    });

    test('sortEvents copes with an event with a broken date, and leaves the list alone', () => {
        const list = [event('ok', 1, 0, 1), event('broken', 1, 99, 99)];
        expect(() => sortEvents(standard, list)).not.toThrow();
        expect(list.map(e => e.id)).toEqual(['ok', 'broken']);
    });

    describe('validateEvent', () => {
        const good = { title: 'Reached the gate', description: '', category: '', year: 1, month: 0, day: 5 };

        test('an event with a title and a real date is fine', () => {
            expect(validateEvent(standard, good)).toEqual({ fields: {}, valid: true });
        });

        test('needs a title, kept short', () => {
            expect(validateEvent(standard, { ...good, title: '  ' }).fields.title).toBe('Give the event a title.');
            expect(validateEvent(standard, { ...good, title: 'x'.repeat(MAX_EVENT_TITLE + 1) }).fields.title).toMatch(/80 characters/);
        });

        test('needs a date that is in the calendar', () => {
            expect(validateEvent(standard, { ...good, month: 1, day: 30 }).fields.date).toMatch(/not in this calendar/);
        });

        test('description and category have limits', () => {
            expect(validateEvent(standard, { ...good, description: 'x'.repeat(4001) }).fields.description).toMatch(/4000/);
            expect(validateEvent(standard, { ...good, category: 'x'.repeat(25) }).fields.category).toMatch(/24/);
        });
    });

    test('eventDocFields saves a trimmed title and category, and never undefined', () => {
        expect(eventDocFields({ title: '  Gate ', category: ' Travel ', year: 1, month: 0, day: 5 })).toEqual({ title: 'Gate', description: '', category: 'Travel', year: 1, month: 0, day: 5 });
    });
});
