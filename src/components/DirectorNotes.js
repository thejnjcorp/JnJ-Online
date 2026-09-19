import { useCallback, useEffect, useRef, useState } from 'react';
import { useDirectorNotes } from '../utils/useDirectorNotes';
import MarkdownEditor from './MarkdownEditor';
import '../styles/DirectorNotes.scss';

export const AUTOSAVE_DELAY_MS = 700;
const RETRY_DELAY_MS = 5000;

const STATUS_TEXT = {
    dirty: 'Unsaved changes…',
    saving: 'Saving…',
    saved: 'All changes saved',
    error: "Couldn't save - will keep trying",
};

function storageKey(campaignId) {
    return `jnj-director-notes-page:${campaignId}`;
}

function readStoredPage(campaignId) {
    try {
        return window.localStorage.getItem(storageKey(campaignId));
    } catch {
        return null;
    }
}

function storePage(campaignId, pageId) {
    try {
        window.localStorage.setItem(storageKey(campaignId), pageId);
    } catch {
        // remembering the last page is a nicety, not something to fail over
    }
}

function formatEdited(timestamp) {
    if (!timestamp?.toDate) return '';
    return timestamp.toDate().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// The Director's private notebook: pages you name and flip between, saved as
// you type. Only rendered for the campaign's directors (see DirectorsPage.js).
//
// Autosave works per page. Every edit is remembered in `pending` (page id ->
// the text you have but the server may not) and saved after a short pause. A
// page stays in `pending` until a save of exactly that text succeeds, which is
// what makes the rest safe: switching pages or leaving flushes it, a failed
// save is retried, and an update arriving from another device is applied only
// to a page you aren't part-way through editing.
export function DirectorNotes({ campaignId }) {
    const { pages, status, createPage, savePage, deletePage } = useDirectorNotes(campaignId);
    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState(null);
    const [saveState, setSaveState] = useState('idle');
    const pending = useRef({});
    const timers = useRef({});
    const titleInput = useRef(null);
    const selectedIdRef = useRef(null);
    selectedIdRef.current = selectedId;
    // A page you've just made is selected before its snapshot has necessarily
    // arrived, so it mustn't count as "the open page disappeared".
    const newPageId = useRef(null);

    // Keep the newest savePage without re-creating callbacks that use it.
    const savePageRef = useRef(savePage);
    savePageRef.current = savePage;

    const selectPage = useCallback((pageId) => {
        setSelectedId(pageId);
        storePage(campaignId, pageId);
    }, [campaignId]);

    // Choose a page once they've loaded (the one you had open last time, else
    // the first) and recover if the open page disappears.
    useEffect(() => {
        if (status !== 'ready' || pages.length === 0) {
            if (selectedId !== null && status === 'ready') setSelectedId(null);
            return;
        }
        if (selectedId && pages.some(page => page.id === selectedId)) {
            newPageId.current = null;
            return;
        }
        if (selectedId && selectedId === newPageId.current) return;
        const remembered = readStoredPage(campaignId);
        setSelectedId(pages.some(page => page.id === remembered) ? remembered : pages[0].id);
    }, [status, pages, selectedId, campaignId]);

    const save = useCallback(async (pageId) => {
        const attempt = pending.current[pageId];
        if (!attempt) return;
        clearTimeout(timers.current[pageId]);
        if (selectedIdRef.current === pageId) setSaveState('saving');
        try {
            await savePageRef.current(pageId, { title: attempt.title, body: attempt.body });
        } catch (error) {
            console.log('Failed to save note: ' + error);
            if (selectedIdRef.current === pageId) setSaveState('error');
            timers.current[pageId] = setTimeout(() => save(pageId), RETRY_DELAY_MS);
            return;
        }
        if (pending.current[pageId] === attempt) {
            delete pending.current[pageId];
            setDraft(current => (current?.id === pageId ? null : current));
            if (selectedIdRef.current === pageId) setSaveState('saved');
        } else {
            // typed more while that was saving: save again
            timers.current[pageId] = setTimeout(() => save(pageId), AUTOSAVE_DELAY_MS);
        }
    }, []);

    const flushAll = useCallback(() => {
        Object.keys(pending.current).forEach(pageId => {
            clearTimeout(timers.current[pageId]);
            save(pageId);
        });
    }, [save]);

    // Leaving the tab, the page or the campaign must not drop what was typed in
    // the last moment.
    useEffect(() => {
        window.addEventListener('pagehide', flushAll);
        const savedTimers = timers.current;
        return () => {
            window.removeEventListener('pagehide', flushAll);
            flushAll();
            Object.values(savedTimers).forEach(clearTimeout);
        };
    }, [flushAll]);

    const page = pages.find(candidate => candidate.id === selectedId) || null;
    const shown = draft?.id === selectedId ? draft : page;

    function edit(changes) {
        if (!page) return;
        const next = { ...(pending.current[page.id] || { title: page.title || '', body: page.body || '' }), ...changes };
        pending.current[page.id] = next;
        setDraft({ id: page.id, ...next });
        setSaveState('dirty');
        clearTimeout(timers.current[page.id]);
        timers.current[page.id] = setTimeout(() => save(page.id), AUTOSAVE_DELAY_MS);
    }

    function openPage(pageId) {
        if (pageId === selectedId) return;
        if (selectedId) {
            clearTimeout(timers.current[selectedId]);
            save(selectedId);
        }
        setSaveState('idle');
        selectPage(pageId);
    }

    async function addPage() {
        if (selectedId) save(selectedId);
        try {
            const pageId = await createPage('New page');
            newPageId.current = pageId;
            setSaveState('idle');
            selectPage(pageId);
            // the title is what you'll want to change first
            setTimeout(() => { titleInput.current?.focus(); titleInput.current?.select(); }, 0);
        } catch (error) {
            console.log('Failed to create note page: ' + error);
            alert("Couldn't create a new page.");
        }
    }

    async function removePage() {
        if (!page) return;
        const label = (shown?.title || '').trim() || 'this page';
        if (!window.confirm(`Delete "${label}"? This can't be undone.`)) return;
        const index = pages.findIndex(candidate => candidate.id === page.id);
        const neighbour = pages[index + 1] || pages[index - 1] || null;
        clearTimeout(timers.current[page.id]);
        delete pending.current[page.id];
        setDraft(null);
        try {
            await deletePage(page.id);
            setSaveState('idle');
            if (neighbour) selectPage(neighbour.id);
        } catch (error) {
            console.log('Failed to delete note page: ' + error);
            alert("Couldn't delete this page.");
        }
    }

    if (status === 'loading') return <div className="DirectorNotes DirectorNotes-message">Loading notes…</div>;
    if (status === 'error') return <div className="DirectorNotes DirectorNotes-message" role="alert">Couldn't load your notes. Check your connection and that you're a director of this campaign.</div>;

    if (pages.length === 0) {
        return <div className="DirectorNotes DirectorNotes-empty">
            <h2>Director's notes</h2>
            <p>A private notebook for this campaign - only directors can see it. Make a page for each thing you want to keep track of, like a session, a villain or a location.</p>
            <button type="button" className="DirectorNotes-primary-button" onClick={addPage}>Create your first page</button>
        </div>;
    }

    const edited = formatEdited(page?.updatedAt);

    return <div className="DirectorNotes">
        <nav className="DirectorNotes-pages" aria-label="Note pages">
            <button type="button" className="DirectorNotes-add-page" onClick={addPage}>+ New page</button>
            <ul>
                {pages.map(candidate => {
                    const title = (candidate.id === selectedId && shown ? shown.title : candidate.title) || '';
                    return <li key={candidate.id}>
                        <button
                            type="button"
                            className={candidate.id === selectedId ? 'DirectorNotes-page-button DirectorNotes-page-button-active' : 'DirectorNotes-page-button'}
                            aria-current={candidate.id === selectedId ? 'page' : undefined}
                            onClick={() => openPage(candidate.id)}
                        >{title.trim() || 'Untitled page'}</button>
                    </li>;
                })}
            </ul>
        </nav>

        {page && shown && <section className="DirectorNotes-editor" aria-label="Page editor">
            <div className="DirectorNotes-editor-header">
                <input
                    ref={titleInput}
                    className="DirectorNotes-title-input"
                    aria-label="Page title"
                    placeholder="Untitled page"
                    value={shown.title || ''}
                    onChange={event => edit({ title: event.target.value })}
                />
                <button type="button" className="DirectorNotes-delete-button" onClick={removePage}>Delete page</button>
            </div>
            <MarkdownEditor
                key={page.id}
                className="DirectorNotes-body"
                label="Page notes"
                placeholder="Start writing - it saves as you type."
                value={shown.body || ''}
                onChange={body => edit({ body })}
            />
            <div className="DirectorNotes-status" role="status" aria-live="polite">
                {STATUS_TEXT[saveState] || (edited ? `Last edited ${edited}` : '')}
            </div>
        </section>}
    </div>;
}
