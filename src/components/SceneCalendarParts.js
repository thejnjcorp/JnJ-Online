import { useState } from 'react';
import { daysInMonth, formatDate } from '../utils/calendar';
import { calendarIsElsewhere, sceneDate, sceneEventFields } from '../utils/scenes';

// A day of the campaign's calendar to put a scene on: day, month and year, or no date. Where the
// scene only has a date written the old way ("Dec 21"), that is shown beside it until one is chosen.
export function CalendarDatePicker({ calendar, value, onChange, label = 'In-world date' }) {
    const set = changes => {
        const next = { ...value, ...changes };
        onChange({ ...next, day: Math.min(Math.max(Number(next.day) || 1, 1), daysInMonth(calendar, next.month) || 1) });
    };
    if (!value) {
        return <fieldset className="Scenes-field" aria-label={label}>
            <span className="Scenes-field-label">{label}</span>
            <span className="Scenes-date-row">
                <span className="Scenes-muted">No date</span>
                <button type="button" className="Scenes-button Scenes-button-small" onClick={() => onChange({ ...calendar.today })}>Set a date</button>
            </span>
        </fieldset>;
    }
    return <fieldset className="Scenes-field" aria-label={label}>
        <span className="Scenes-field-label">{label}</span>
        <span className="Scenes-date-row">
            <input type="number" min={1} max={daysInMonth(calendar, value.month)} aria-label={`${label}, day`} value={value.day} onChange={event => set({ day: event.target.value })}/>
            <select aria-label={`${label}, month`} value={value.month} onChange={event => set({ month: Number(event.target.value) })}>
                {calendar.months.map((month, index) => <option key={month.name} value={index}>{month.name}</option>)}
            </select>
            <input type="number" aria-label={`${label}, year`} value={value.year} onChange={event => set({ year: Number(event.target.value) || 0 })}/>
        </span>
        <span className="Scenes-date-row">
            <button type="button" className="Scenes-button Scenes-button-small" onClick={() => onChange({ ...calendar.today })}>Calendar's today</button>
            <button type="button" className="Scenes-button Scenes-button-small" onClick={() => onChange(null)}>No date</button>
        </span>
    </fieldset>;
}

// Starting a scene that is on a different day to the calendar's today: whether to move the calendar to it.
export function MoveCalendarOption({ scene, calendar, checked, onChange }) {
    if (!calendarIsElsewhere(scene, calendar)) return null;
    return <label className="Scenes-waiting">
        <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)}/>
        {`Move the calendar to ${formatDate(calendar, sceneDate(scene, calendar))} (it says ${formatDate(calendar, calendar.today)})`}
    </label>;
}

// While a scene runs: the calendar is on another day, and the way to put it on this scene's.
export function CalendarSync({ scene, calendar, onSync }) {
    const [busy, setBusy] = useState(false);
    if (!calendarIsElsewhere(scene, calendar)) return null;
    const date = formatDate(calendar, sceneDate(scene, calendar));
    return <button type="button" className="Scenes-button" disabled={busy} title={`The party calendar says today is ${formatDate(calendar, calendar.today)}`}
        onClick={async () => { setBusy(true); try { await onSync(sceneDate(scene, calendar)); } finally { setBusy(false); } }}>{`Set calendar to ${date}`}</button>;
}

// Ending a scene that has a day and has not been put on the calendar: whether to log it there.
export function EndSceneCard({ scene, calendar, onEnd, onCancel }) {
    const [log, setLog] = useState(true);
    const fields = sceneEventFields(scene, calendar);
    return <section className="Scenes-card Scenes-end-card" aria-label="End this scene">
        <strong>End this scene?</strong>
        <label className="Scenes-waiting">
            <input type="checkbox" checked={log} onChange={event => setLog(event.target.checked)}/>
            {`Add "${fields.title}" to the party's calendar on ${formatDate(calendar, sceneDate(scene, calendar))}`}
        </label>
        <div className="Scenes-row-actions">
            <button type="button" className="Scenes-button Scenes-button-primary" onClick={() => onEnd({ logOnCalendar: log })}>End scene</button>
            <button type="button" className="Scenes-button" onClick={onCancel}>Keep running</button>
        </div>
    </section>;
}

// Whether ending the scene has something to ask: it has a day, and it is not on the calendar yet.
export const endAsksAboutCalendar = (scene, calendar) => Boolean(sceneDate(scene, calendar)) && !scene.calendarEventId;
