import { useMemo, useState } from 'react';
import { updateParty } from '../utils/party';
import { usePartyEvents } from '../utils/usePartyEvents';
import {
    MAX_EVENT_DESCRIPTION, MAX_EVENT_TITLE, MAX_MONTHS, MAX_MONTH_DAYS, MAX_NAME_LENGTH, MAX_TAGS, MAX_WEEKDAYS, RECURRENCES,
    addDays, calendarOf, daysInMonth, eventDate, eventDocFields, eventsOnDate, findTag, formatDate, formatMonth, hasHappened, isValidDate, monthGrid, nextTagColor, recurrenceLabel, sameDate, shiftMonth,
    tagStyle, tagsOf, validateCalendar, validateEvent,
} from '../utils/calendar';
import '../styles/Party.scss';

const emptyEvent = date => ({ id: null, title: '', category: '', description: '', recurrence: 'none', ...date });

// An event's category, as a pill - in its tag's colour when it has one, otherwise
// plain, exactly as before tags existed.
function EventTag({ calendar, category }) {
    if (!category) return null;
    const tag = findTag(calendar, category);
    return <span className={['ItemList-tag', tag && 'Calendar-tag-custom'].filter(Boolean).join(' ')} style={tagStyle(calendar, category)}>{category}</span>;
}

// Add or change one event: its title, what kind of thing it was, what happened, and
// the day it happened on.
function EventForm({ calendar, initial, onSave, onCancel }) {
    const [form, setForm] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const validation = validateEvent(calendar, form);
    const set = changes => setForm(current => ({ ...current, ...changes }));

    async function save() {
        if (!validation.valid) { setError(Object.values(validation.fields)[0]); return; }
        setSaving(true);
        setError('');
        try {
            await onSave(eventDocFields(form));
        } catch (saveError) {
            setError(saveError.message);
            setSaving(false);
        }
    }

    return <form className="Calendar-event-form" noValidate onSubmit={event => { event.preventDefault(); save(); }} aria-label={form.id ? 'Change event' : 'Add an event'}>
        <input className="Party-input" aria-label="Event title" placeholder="What happened?" maxLength={MAX_EVENT_TITLE + 20} value={form.title} onChange={event => set({ title: event.target.value })}/>
        {tagsOf(calendar).length > 0
            ? <select className="Party-input" aria-label="Event category" value={form.category} onChange={event => set({ category: event.target.value })}>
                <option value="">No tag</option>
                {tagsOf(calendar).map(tag => <option key={tag.name} value={tag.name}>{tag.name}</option>)}
                {form.category && !findTag(calendar, form.category) && <option value={form.category}>{form.category} (not a tag)</option>}
            </select>
            : <input className="Party-input" aria-label="Event category" placeholder="Kind of event (optional): travel, battle, purchase…" value={form.category} onChange={event => set({ category: event.target.value })}/>}
        <div className="Party-hint">Use "Manage tags" above to colour-code a kind of event, like a Holiday.</div>
        <textarea className="Party-input Calendar-textarea" aria-label="Event details" placeholder="Details, so the party can look back on it" maxLength={MAX_EVENT_DESCRIPTION} rows={3} value={form.description} onChange={event => set({ description: event.target.value })}/>
        <div className="Calendar-date-fields">
            <label>Day
                <input className="Party-input Party-input-narrow" type="number" min={1} max={daysInMonth(calendar, form.month) || undefined} aria-label="Event day" value={form.day} onChange={event => set({ day: Number(event.target.value) })}/>
            </label>
            <label>Month
                <select className="Party-input" aria-label="Event month" value={form.month} onChange={event => set({ month: Number(event.target.value) })}>
                    {calendar.months.map((month, index) => <option key={index} value={index}>{month.name}</option>)}
                </select>
            </label>
            <label>Year
                <input className="Party-input Party-input-narrow" type="number" aria-label="Event year" value={form.year} onChange={event => set({ year: Number(event.target.value) })}/>
            </label>
            <label>Repeats
                <select className="Party-input" aria-label="Repeats" value={form.recurrence || 'none'} onChange={event => set({ recurrence: event.target.value })}>
                    {RECURRENCES.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
            </label>
        </div>
        {error && <div className="Party-error" role="alert">{error}</div>}
        <div className="Calendar-form-actions">
            <button type="submit" className="Party-button Party-button-primary" disabled={saving}>{form.id ? 'Save changes' : 'Add event'}</button>
            <button type="button" className="Party-button" onClick={onCancel}>Cancel</button>
        </div>
    </form>;
}

// The director's setup of the calendar: the weekdays, the months and their lengths, and
// what day it is. Nothing is saved until it is valid.
function CalendarSettings({ calendar, onSave, onClose }) {
    const [draft, setDraft] = useState(() => structuredClone(calendar));
    const [problems, setProblems] = useState([]);
    const [saving, setSaving] = useState(false);

    const changeMonth = (index, changes) => setDraft(current => ({ ...current, months: current.months.map((month, i) => (i === index ? { ...month, ...changes } : month)) }));
    const changeWeekday = (index, name) => setDraft(current => ({ ...current, weekdays: current.weekdays.map((day, i) => (i === index ? name : day)) }));
    const changeToday = changes => setDraft(current => ({ ...current, today: { ...current.today, ...changes } }));

    async function save() {
        const result = validateCalendar(draft);
        setProblems(result.problems);
        if (!result.valid) return;
        setSaving(true);
        try {
            await onSave(draft);
            onClose();
        } catch (error) {
            setProblems([error.message]);
            setSaving(false);
        }
    }

    return <section className="Calendar-settings" aria-label="Calendar settings">
        <h3 className="Party-section-title">Calendar setup</h3>
        <div className="Party-hint">Set the calendar to match your world. Events keep the day, month number and year they were given, so shortening the year can leave events on days that no longer exist.</div>

        <h4 className="Calendar-settings-heading">Weekdays</h4>
        {draft.weekdays.map((name, index) => <div className="Calendar-settings-row" key={index}>
            <input className="Party-input" aria-label={`Weekday ${index + 1}`} maxLength={MAX_NAME_LENGTH + 5} value={name} onChange={event => changeWeekday(index, event.target.value)}/>
            <button type="button" className="Party-button" aria-label={`Remove weekday ${index + 1}`} disabled={draft.weekdays.length <= 1} onClick={() => setDraft(current => ({ ...current, weekdays: current.weekdays.filter((_, i) => i !== index) }))}>Remove</button>
        </div>)}
        <button type="button" className="Party-button" disabled={draft.weekdays.length >= MAX_WEEKDAYS} onClick={() => setDraft(current => ({ ...current, weekdays: [...current.weekdays, `Day ${current.weekdays.length + 1}`] }))}>+ Add a weekday</button>

        <h4 className="Calendar-settings-heading">Months</h4>
        {draft.months.map((month, index) => <div className="Calendar-settings-row" key={index}>
            <input className="Party-input" aria-label={`Month ${index + 1} name`} maxLength={MAX_NAME_LENGTH + 5} value={month.name} onChange={event => changeMonth(index, { name: event.target.value })}/>
            <input className="Party-input Party-input-narrow" type="number" min={1} max={MAX_MONTH_DAYS} aria-label={`Month ${index + 1} days`} value={month.days} onChange={event => changeMonth(index, { days: Number(event.target.value) })}/>
            <span className="Party-hint">days</span>
            <button type="button" className="Party-button" aria-label={`Remove month ${index + 1}`} disabled={draft.months.length <= 1} onClick={() => setDraft(current => ({ ...current, months: current.months.filter((_, i) => i !== index) }))}>Remove</button>
        </div>)}
        <button type="button" className="Party-button" disabled={draft.months.length >= MAX_MONTHS} onClick={() => setDraft(current => ({ ...current, months: [...current.months, { name: `Month ${current.months.length + 1}`, days: 30 }] }))}>+ Add a month</button>

        <h4 className="Calendar-settings-heading">Today</h4>
        <div className="Calendar-date-fields">
            <label>Day <input className="Party-input Party-input-narrow" type="number" aria-label="Today's day" value={draft.today.day} onChange={event => changeToday({ day: Number(event.target.value) })}/></label>
            <label>Month
                <select className="Party-input" aria-label="Today's month" value={draft.today.month} onChange={event => changeToday({ month: Number(event.target.value) })}>
                    {draft.months.map((month, index) => <option key={index} value={index}>{month.name}</option>)}
                </select>
            </label>
            <label>Year <input className="Party-input Party-input-narrow" type="number" aria-label="Today's year" value={draft.today.year} onChange={event => changeToday({ year: Number(event.target.value) })}/></label>
        </div>

        {problems.length > 0 && <ul className="Party-error" role="alert">{problems.map(problem => <li key={problem}>{problem}</li>)}</ul>}
        <div className="Calendar-form-actions">
            <button type="button" className="Party-button Party-button-primary" disabled={saving} onClick={save}>Save calendar</button>
            <button type="button" className="Party-button" onClick={onClose}>Cancel</button>
        </div>
    </section>;
}

// Anyone in the party can define tags (a Holiday, say) and give each its own colour -
// not only the director, and not tucked away inside the calendar's structural setup,
// since it is whoever is adding an event who needs to reach for one. Each change is
// saved straight away. Removing a tag leaves the events that used it with a plain,
// uncoloured pill - their category text is untouched.
function TagManager({ campaignId, calendar }) {
    const tags = tagsOf(calendar);
    const [adding, setAdding] = useState(null); // { name, color } while a new tag is being made
    const [editingIndex, setEditingIndex] = useState(null);
    const [editDraft, setEditDraft] = useState(null);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    async function commit(nextTags) {
        setMessage('');
        setBusy(true);
        try {
            // reads the live calendar at write time, so a tag someone else just added a
            // moment ago is not clobbered by a change that started before it arrived
            await updateParty(campaignId, party => ({ calendar: { ...calendarOf(party), tags: nextTags } }));
            return true;
        } catch (error) {
            setMessage(error.message);
            return false;
        } finally {
            setBusy(false);
        }
    }

    function nameProblem(name, ignoreIndex) {
        const trimmed = name.trim();
        if (!trimmed) return 'Give the tag a name.';
        if (trimmed.length > MAX_NAME_LENGTH) return `Keep the name to ${MAX_NAME_LENGTH} characters.`;
        if (tags.some((tag, i) => i !== ignoreIndex && tag.name.trim().toLowerCase() === trimmed.toLowerCase())) return 'There is already a tag with that name.';
        return null;
    }

    async function addTag() {
        const problem = nameProblem(adding.name, -1);
        if (problem) { setMessage(problem); return; }
        if (await commit([...tags, { name: adding.name.trim(), color: adding.color }])) setAdding(null);
    }

    async function saveEdit(index) {
        const problem = nameProblem(editDraft.name, index);
        if (problem) { setMessage(problem); return; }
        if (await commit(tags.map((tag, i) => (i === index ? { name: editDraft.name.trim(), color: editDraft.color } : tag)))) setEditingIndex(null);
    }

    async function removeTag(index) {
        if (!window.confirm(`Remove the "${tags[index].name}" tag? Events that used it keep their name, just without the colour.`)) return;
        await commit(tags.filter((_, i) => i !== index));
    }

    const startAdding = () => { setAdding({ name: tags.length === 0 ? 'Holiday' : '', color: nextTagColor(tags) }); setEditingIndex(null); setMessage(''); };
    const startEditing = index => { setEditingIndex(index); setEditDraft(tags[index]); setAdding(null); setMessage(''); };

    return <section className="Calendar-tags" aria-label="Tags">
        <div className="Party-hint">Colour-code kinds of event - a Holiday, say - so they stand out from the plain ones anyone adds. Pick a tag when adding or changing an event, below.</div>
        {message && <div className="Party-error" role="alert">{message}</div>}
        {tags.length > 0 && <div className="Calendar-tags-list">
            {tags.map((tag, index) => editingIndex === index
                ? <div className="Calendar-settings-row" key={tag.name}>
                    <input className="Party-input" aria-label={`Tag ${index + 1} name`} maxLength={MAX_NAME_LENGTH + 5} value={editDraft.name} onChange={event => setEditDraft(current => ({ ...current, name: event.target.value }))}/>
                    <input className="Calendar-tag-color" type="color" aria-label={`Tag ${index + 1} colour`} value={editDraft.color} onChange={event => setEditDraft(current => ({ ...current, color: event.target.value }))}/>
                    <button type="button" className="Party-button Party-button-primary" disabled={busy} onClick={() => saveEdit(index)}>Save</button>
                    <button type="button" className="Party-button" onClick={() => setEditingIndex(null)}>Cancel</button>
                </div>
                : <div className="Calendar-tags-row" key={tag.name}>
                    <span className="ItemList-tag Calendar-tag-custom" style={tagStyle(calendar, tag.name)}>{tag.name}</span>
                    <button type="button" className="Party-button" aria-label={`Edit ${tag.name}`} onClick={() => startEditing(index)}>Edit</button>
                    <button type="button" className="Party-button Party-button-danger" aria-label={`Remove ${tag.name}`} disabled={busy} onClick={() => removeTag(index)}>Remove</button>
                </div>)}
        </div>}
        {adding
            ? <div className="Calendar-settings-row">
                <input className="Party-input" aria-label="New tag name" maxLength={MAX_NAME_LENGTH + 5} autoFocus value={adding.name} onChange={event => setAdding(current => ({ ...current, name: event.target.value }))}/>
                <input className="Calendar-tag-color" type="color" aria-label="New tag colour" value={adding.color} onChange={event => setAdding(current => ({ ...current, color: event.target.value }))}/>
                <button type="button" className="Party-button Party-button-primary" disabled={busy} onClick={addTag}>Add tag</button>
                <button type="button" className="Party-button" onClick={() => setAdding(null)}>Cancel</button>
            </div>
            : <button type="button" className="Party-button" disabled={tags.length >= MAX_TAGS} onClick={startAdding}>+ Add a tag</button>}
    </section>;
}

// The party's calendar: a month at a time, with what the party has done on each day, and
// today's date as the game has it (anyone can move that on as the story does). For
// bookkeeping - when did we reach the gate, how long ago did we buy the horses. The
// director sets up the calendar itself.
export function PartyCalendarTab({ campaignId, party, isDirector }) {
    const calendar = useMemo(() => calendarOf(party), [party]);
    const { events, status, addEvent, saveEvent, deleteEvent } = usePartyEvents(campaignId, calendar);
    const today = calendar.today;
    const [viewed, setViewed] = useState(null);
    const [picked, setPicked] = useState(null);
    const [editing, setEditing] = useState(null); // an event form's starting values, or null
    const [settingUp, setSettingUp] = useState(false);
    const [managingTags, setManagingTags] = useState(false);
    const [message, setMessage] = useState('');

    const view = viewed ?? { year: today.year, month: today.month };
    const selected = picked ?? today;
    const grid = monthGrid(calendar, view.year, view.month);
    const dayEvents = eventsOnDate(calendar, events, selected);
    const happened = events.filter(event => hasHappened(calendar, event));

    async function run(action) {
        setMessage('');
        try {
            await action();
        } catch (error) {
            setMessage(error.message);
        }
    }

    // Structural changes (weekdays, months, today) never touch tags, so this always
    // keeps whatever tags are live at the moment it saves, even if someone else added
    // one after this was opened.
    const saveCalendar = next => updateParty(campaignId, party => ({ calendar: { ...next, tags: tagsOf(calendarOf(party)) } }));
    const setToday = date => run(() => saveCalendar({ ...calendar, today: date }));

    function pick(date) {
        setPicked(date);
        setEditing(null);
    }

    return <div className="Calendar">
        {message && <div className="Party-error" role="alert">{message}</div>}

        <div className="Calendar-today">
            <span>Today: <strong>{formatDate(calendar, today)}</strong></span>
            <button type="button" className="Party-button" onClick={() => setToday(addDays(calendar, today, 1))}>Next day</button>
            <button type="button" className="Party-button" disabled={sameDate(selected, today)} onClick={() => setToday(selected)}>Make {formatDate(calendar, selected)} today</button>
            <button type="button" className="Party-button" aria-pressed={managingTags} onClick={() => setManagingTags(!managingTags)}>Manage tags</button>
            {isDirector && <button type="button" className="Party-button" aria-pressed={settingUp} onClick={() => setSettingUp(!settingUp)}>Set up the calendar</button>}
        </div>

        {managingTags && <TagManager campaignId={campaignId} calendar={calendar}/>}

        {settingUp && <CalendarSettings calendar={calendar} onSave={saveCalendar} onClose={() => setSettingUp(false)}/>}

        <div className="Calendar-nav">
            <button type="button" className="Party-button" aria-label="Previous month" onClick={() => setViewed(shiftMonth(calendar, view, -1))}>◀</button>
            <h2 className="Calendar-month-title" aria-live="polite">{formatMonth(calendar, view)}</h2>
            <button type="button" className="Party-button" aria-label="Next month" onClick={() => setViewed(shiftMonth(calendar, view, 1))}>▶</button>
            <button type="button" className="Party-button" onClick={() => { setViewed(null); pick(today); }}>Back to today</button>
        </div>

        <table className="Calendar-grid" aria-label={formatMonth(calendar, view)}>
            <thead>
                <tr>{calendar.weekdays.map((name, index) => <th scope="col" key={index}>{name}</th>)}</tr>
            </thead>
            <tbody>
                {grid.map((week, row) => <tr key={row}>
                    {week.map((day, column) => {
                        if (day === null) return <td key={column} className="Calendar-blank"/>;
                        const date = { year: view.year, month: view.month, day };
                        const here = eventsOnDate(calendar, events, date);
                        const dayTagColor = here.map(event => findTag(calendar, event.category)?.color).find(Boolean);
                        const classes = ['Calendar-day', sameDate(date, today) && 'Calendar-day-today', sameDate(date, selected) && 'Calendar-day-selected', dayTagColor && 'Calendar-day-tagged'].filter(Boolean).join(' ');
                        return <td key={column}>
                            <button type="button" className={classes} style={dayTagColor ? { '--calendar-tag-color': dayTagColor } : undefined} aria-pressed={sameDate(date, selected)} aria-label={`${formatDate(calendar, date)}${here.length ? `, ${here.length} ${here.length === 1 ? 'event' : 'events'}` : ''}${sameDate(date, today) ? ', today' : ''}`} onClick={() => pick(date)}>
                                <span className="Calendar-day-number">{day}</span>
                                {here.slice(0, 2).map(event => {
                                    const tag = findTag(calendar, event.category);
                                    return <span className="Calendar-day-event" key={event.id} style={tag ? { '--calendar-tag-color': tag.color } : undefined}>{tag && <span className="Calendar-day-event-dot" aria-hidden="true"/>}{event.title}</span>;
                                })}
                                {here.length > 2 && <span className="Calendar-day-more">+{here.length - 2} more</span>}
                            </button>
                        </td>;
                    })}
                </tr>)}
            </tbody>
        </table>

        <section className="Calendar-day-panel" aria-label={`Events on ${formatDate(calendar, selected)}`}>
            <div className="Party-section-header">
                <h2 className="Party-section-title">{formatDate(calendar, selected)}</h2>
                {!editing && <button type="button" className="Party-button Party-button-primary" onClick={() => setEditing(emptyEvent(selected))}>Add an event</button>}
            </div>
            {status === 'loading' && <div className="Party-hint">Loading events…</div>}
            {status === 'error' && <div className="Party-error" role="alert">Couldn't load the calendar's events.</div>}
            {status === 'ready' && dayEvents.length === 0 && !editing && <div className="Party-hint">Nothing recorded for this day.</div>}
            <ul className="Party-list">
                {dayEvents.map(event => <li key={event.id} className="Party-list-item Calendar-event">
                    {editing?.id === event.id
                        ? <EventForm calendar={calendar} initial={editing} onCancel={() => setEditing(null)} onSave={async fields => { await saveEvent(event.id, fields); setEditing(null); }}/>
                        : <>
                            <div className="Calendar-event-head">
                                <strong>{event.title}</strong>
                                <EventTag calendar={calendar} category={event.category}/>
                                {event.recurrence && event.recurrence !== 'none' && <span className="Party-hint">↻ {recurrenceLabel(event.recurrence)}</span>}
                            </div>
                            {event.description && <p className="Calendar-event-description">{event.description}</p>}
                            <div className="Party-hint">{event.created_by_name ? `Added by ${event.created_by_name}` : ''}</div>
                            <div className="Calendar-form-actions">
                                <button type="button" className="Party-button" aria-label={`Change ${event.title}`} onClick={() => setEditing({ id: event.id, title: event.title, category: event.category || '', description: event.description || '', recurrence: event.recurrence || 'none', ...eventDate(event) })}>Change</button>
                                <button type="button" className="Party-button Party-button-danger" aria-label={`Delete ${event.title}`} onClick={() => { if (window.confirm(`Delete "${event.title}"?`)) run(() => deleteEvent(event.id)); }}>Delete</button>
                            </div>
                        </>}
                </li>)}
            </ul>
            {editing && !editing.id && <EventForm calendar={calendar} initial={editing} onCancel={() => setEditing(null)} onSave={async fields => { await addEvent(fields); setEditing(null); }}/>}
        </section>

        <section className="Party-section" aria-label="Everything that has happened">
            <div className="Party-section-header"><h2 className="Party-section-title">Everything that has happened</h2></div>
            {status === 'ready' && happened.length === 0 && <div className="Party-hint">No events yet. Pick a day above and add the first.</div>}
            <ul className="Party-list">
                {happened.map(event => <li key={event.id} className="Party-list-item Calendar-timeline-item">
                    <button type="button" className="Calendar-timeline-date" disabled={!isValidDate(calendar, eventDate(event))} onClick={() => { setViewed({ year: event.year, month: event.month }); pick(eventDate(event)); }}>
                        {isValidDate(calendar, eventDate(event)) ? formatDate(calendar, eventDate(event)) : 'A date that is no longer in the calendar'}
                    </button>
                    <span>{event.title}</span>
                    <EventTag calendar={calendar} category={event.category}/>
                    {event.recurrence && event.recurrence !== 'none' && <span className="Party-hint">↻ {recurrenceLabel(event.recurrence)}</span>}
                </li>)}
            </ul>
        </section>
    </div>;
}
