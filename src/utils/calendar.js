import { isHexColor, readableOn } from './statusStyle';

// The party's calendar: an in-game calendar for keeping track of what happened when.
//
// A calendar is set up per campaign (kept on the party doc as `calendar`) - the names
// of its weekdays, its months and how many days each has - because a table's world
// may well not run on ours. It starts as the ordinary one. Months are numbered from 0
// and days from 1, and a date is { year, month, day }. There are no leap years: every
// year has the same length, so what day of the week a date falls on is only counting
// days from year 0 (whatever weekday that was is an arbitrary anchor - the same for
// everyone at the table).
//
// The events kept on it (`party_events`) are { title, description, category, year,
// month, day }. A director can also define a set of tags (name + colour, e.g.
// "Holiday") on the calendar itself; an event whose `category` matches a tag's name
// is coloured with it, so tagged events stand out from the plain ones players add.

export const MAX_MONTHS = 30;
export const MAX_WEEKDAYS = 14;
export const MAX_MONTH_DAYS = 100;
export const MAX_NAME_LENGTH = 24;
export const MAX_TAGS = 20;

// Offered to a new tag in turn, so several added at once are not all the same colour.
export const TAG_COLOR_PALETTE = ['#e0b34d', '#4d9de0', '#e15554', '#3bb273', '#9b5de5', '#f4a259', '#5c80bc', '#d65db1'];

export const defaultCalendar = () => ({
    weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    months: [
        { name: 'January', days: 31 }, { name: 'February', days: 28 }, { name: 'March', days: 31 }, { name: 'April', days: 30 },
        { name: 'May', days: 31 }, { name: 'June', days: 30 }, { name: 'July', days: 31 }, { name: 'August', days: 31 },
        { name: 'September', days: 30 }, { name: 'October', days: 31 }, { name: 'November', days: 30 }, { name: 'December', days: 31 },
    ],
    today: { year: 1, month: 0, day: 1 },
    tags: [],
});

const isWhole = value => Number.isInteger(value);

// The calendar as stored, or the ordinary one where nothing usable is stored.
export function calendarOf(party) {
    const stored = party?.calendar;
    return validateCalendar(stored).valid ? stored : defaultCalendar();
}

// Problems with a calendar's setup, as plain sentences.
export function validateCalendar(calendar) {
    const problems = [];
    if (!calendar || typeof calendar !== 'object') return { valid: false, problems: ['There is no calendar.'] };
    const { weekdays, months, today } = calendar;
    if (!Array.isArray(weekdays) || weekdays.length < 1 || weekdays.length > MAX_WEEKDAYS) problems.push(`A week needs from 1 to ${MAX_WEEKDAYS} days.`);
    else if (weekdays.some(name => typeof name !== 'string' || name.trim() === '' || name.length > MAX_NAME_LENGTH)) problems.push(`Each weekday needs a name of up to ${MAX_NAME_LENGTH} characters.`);
    if (!Array.isArray(months) || months.length < 1 || months.length > MAX_MONTHS) problems.push(`A year needs from 1 to ${MAX_MONTHS} months.`);
    else {
        if (months.some(month => typeof month?.name !== 'string' || month.name.trim() === '' || month.name.length > MAX_NAME_LENGTH)) problems.push(`Each month needs a name of up to ${MAX_NAME_LENGTH} characters.`);
        if (months.some(month => !isWhole(month?.days) || month.days < 1 || month.days > MAX_MONTH_DAYS)) problems.push(`Each month needs from 1 to ${MAX_MONTH_DAYS} days.`);
    }
    const tags = calendar.tags ?? [];
    if (!Array.isArray(tags) || tags.length > MAX_TAGS) problems.push(`There can be at most ${MAX_TAGS} tags.`);
    else {
        if (tags.some(tag => typeof tag?.name !== 'string' || tag.name.trim() === '' || tag.name.length > MAX_NAME_LENGTH)) problems.push(`Each tag needs a name of up to ${MAX_NAME_LENGTH} characters.`);
        if (tags.some(tag => !isHexColor(tag?.color))) problems.push('Each tag needs a colour.');
        const names = tags.map(tag => (tag.name || '').trim().toLowerCase());
        if (new Set(names).size !== names.length) problems.push('Two tags cannot have the same name.');
    }
    if (problems.length === 0 && !isValidDate(calendar, today)) problems.push('Today is not a date in this calendar.');
    return { valid: problems.length === 0, problems };
}

export const daysInMonth = (calendar, month) => calendar.months[month]?.days ?? 0;

export const yearLength = calendar => calendar.months.reduce((total, month) => total + month.days, 0);

export function isValidDate(calendar, date) {
    return Boolean(date) && isWhole(date.year) && isWhole(date.month) && isWhole(date.day)
        && date.month >= 0 && date.month < calendar.months.length
        && date.day >= 1 && date.day <= daysInMonth(calendar, date.month);
}

// How many days the date is after the start of year 0 (negative years are before it).
export function dayNumber(calendar, date) {
    const before = calendar.months.slice(0, date.month).reduce((total, month) => total + month.days, 0);
    return date.year * yearLength(calendar) + before + (date.day - 1);
}

// The date that is this many days from the start of year 0.
export function dateFromDayNumber(calendar, number) {
    const length = yearLength(calendar);
    const year = Math.floor(number / length);
    let rest = number - year * length;
    let month = 0;
    while (rest >= calendar.months[month].days) {
        rest -= calendar.months[month].days;
        month += 1;
    }
    return { year, month, day: rest + 1 };
}

export const addDays = (calendar, date, days) => dateFromDayNumber(calendar, dayNumber(calendar, date) + days);

export const daysBetween = (calendar, from, to) => dayNumber(calendar, to) - dayNumber(calendar, from);

export const compareDates = (calendar, a, b) => dayNumber(calendar, a) - dayNumber(calendar, b);

export const sameDate = (a, b) => Boolean(a && b) && a.year === b.year && a.month === b.month && a.day === b.day;

// The weekday a date falls on, as an index into `weekdays`.
export function weekdayOf(calendar, date) {
    const count = calendar.weekdays.length;
    return ((dayNumber(calendar, date) % count) + count) % count;
}

// A month as rows of weeks: each row has one cell per weekday - a day number, or null
// for a blank before the month starts or after it ends.
export function monthGrid(calendar, year, month) {
    const columns = calendar.weekdays.length;
    const blanks = weekdayOf(calendar, { year, month, day: 1 });
    const cells = [...Array(blanks).fill(null), ...Array.from({ length: daysInMonth(calendar, month) }, (_, i) => i + 1)];
    while (cells.length % columns !== 0) cells.push(null);
    return Array.from({ length: cells.length / columns }, (_, row) => cells.slice(row * columns, (row + 1) * columns));
}

// The month before or after one (rolling over the year).
export function shiftMonth(calendar, { year, month }, by) {
    const total = year * calendar.months.length + month + by;
    const nextYear = Math.floor(total / calendar.months.length);
    return { year: nextYear, month: total - nextYear * calendar.months.length };
}

export const formatDate = (calendar, date) => `${date.day} ${calendar.months[date.month]?.name ?? '?'}, year ${date.year}`;

export const formatMonth = (calendar, { year, month }) => `${calendar.months[month]?.name ?? '?'}, year ${year}`;

// --- Tags ----------------------------------------------------------------------------

export const tagsOf = calendar => calendar.tags ?? [];

// The tag a name matches (case-insensitively), or null - for a category that is not
// tagged, or no longer matches a tag that was renamed or removed.
export function findTag(calendar, name) {
    const needle = (name || '').trim().toLowerCase();
    if (!needle) return null;
    return tagsOf(calendar).find(tag => tag.name.trim().toLowerCase() === needle) ?? null;
}

// A colour a new tag can start with, cycling the palette so tags added one after
// another are not all the same colour.
export const nextTagColor = tags => TAG_COLOR_PALETTE[tags.length % TAG_COLOR_PALETTE.length];

// The inline style that gives an event's tag its own colour, or nothing when it is
// not tagged. Pair with a `Calendar-tag-custom` class, the same way a status chip does.
export function tagStyle(calendar, category) {
    const tag = findTag(calendar, category);
    if (!tag) return undefined;
    return { '--calendar-tag-color': tag.color, '--calendar-tag-on-color': readableOn(tag.color) };
}

// --- Events ------------------------------------------------------------------------

export const MAX_EVENT_TITLE = 80;
export const MAX_EVENT_DESCRIPTION = 4000;
export const MAX_EVENT_CATEGORY = 24;

// An event's `recurrence` (default 'none'): it keeps happening on the day it was
// given, every week, month or year from now on - both before and after the date it
// was first recorded on, the same as a real holiday or a standing market day would.
export const RECURRENCES = [
    { key: 'none', label: 'Does not repeat' },
    { key: 'weekly', label: 'Every week' },
    { key: 'monthly', label: 'Every month' },
    { key: 'yearly', label: 'Every year' },
];

export const recurrenceLabel = key => RECURRENCES.find(option => option.key === key)?.label ?? RECURRENCES[0].label;

export const eventDate = event => ({ year: event.year, month: event.month, day: event.day });

// Whether an event falls on a date: on its own day for one that does not repeat, or
// on every day since that shares what its recurrence cares about - the weekday, the
// day of the month, or the month and day.
export function occursOn(calendar, event, date) {
    const anchor = eventDate(event);
    switch (event.recurrence) {
        case 'weekly': return weekdayOf(calendar, date) === weekdayOf(calendar, anchor);
        case 'monthly': return date.day === anchor.day;
        case 'yearly': return date.month === anchor.month && date.day === anchor.day;
        default: return sameDate(date, anchor);
    }
}

export const eventsOnDate = (calendar, events, date) => events.filter(event => occursOn(calendar, event, date));

// Events in the order they happened; ones on the same day by when they were added.
export function sortEvents(calendar, events) {
    return [...events].sort((a, b) => {
        const byDate = isValidDate(calendar, eventDate(a)) && isValidDate(calendar, eventDate(b)) ? compareDates(calendar, eventDate(a), eventDate(b)) : 0;
        if (byDate !== 0) return byDate;
        return (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0) || String(a.title || '').localeCompare(String(b.title || ''));
    });
}

export function validateEvent(calendar, event) {
    const fields = {};
    if (typeof event.title !== 'string' || event.title.trim() === '') fields.title = 'Give the event a title.';
    else if (event.title.trim().length > MAX_EVENT_TITLE) fields.title = `Keep the title to ${MAX_EVENT_TITLE} characters.`;
    if (typeof event.description === 'string' && event.description.length > MAX_EVENT_DESCRIPTION) fields.description = `Keep the description to ${MAX_EVENT_DESCRIPTION} characters.`;
    if (typeof event.category === 'string' && event.category.trim().length > MAX_EVENT_CATEGORY) fields.category = `Keep the category to ${MAX_EVENT_CATEGORY} characters.`;
    if (!isValidDate(calendar, eventDate(event))) fields.date = 'That date is not in this calendar.';
    return { fields, valid: Object.keys(fields).length === 0 };
}

// What an event's form saves.
export const eventDocFields = event => ({
    title: event.title.trim(),
    description: event.description || '',
    category: (event.category || '').trim(),
    year: event.year,
    month: event.month,
    day: event.day,
    recurrence: RECURRENCES.some(option => option.key === event.recurrence) ? event.recurrence : 'none',
});
