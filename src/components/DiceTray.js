import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { HexColorPicker } from 'react-colorful';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import '../styles/DiceTray.scss';
import { DIE_SIDES, breakdownText, diceColorContext, emptyPool, grandTotal, poolCount } from '../utils/diceTray';

// @3d-dice/dice-box's static assets (dice models, textures, its physics
// engine's .wasm file) - copied from node_modules/@3d-dice/dice-box/dist/assets
// into public/dice-box-assets at install time (see that folder's own note).
// PUBLIC_URL is needed because the site is served from a subpath (GitHub
// Pages), not the domain root.
const ASSET_PATH = `${process.env.PUBLIC_URL}/dice-box-assets/`;
const STAGE_ID = 'DiceTray-stage';
// Default is 6; a bit larger reads better against the small tray.
const DICE_SCALE = 8;

// Reads the live theme's accent colour rather than hardcoding one, but only
// ever called at render/interaction time, never cached in state from the
// very first render - the App shell adds its theme class to <html> in its
// own effect, which (children's effects committing before their parent's)
// can still be missing the first time DiceTray itself would otherwise ever
// read it, permanently freezing the wrong fallback in state.
const fallbackColor = () => getComputedStyle(document.documentElement).getPropertyValue('--jnj-color-accent').trim() || '#7c4dff';

// A floating tray, open from a character sheet or director view, for rolling
// the polyhedral dice this app's classes are built from (see DIE_SIDES).
// Click a die to toss one more of it in; the running total (plus an optional
// flat modifier) is kept until Clear. The 3D engine (@3d-dice/dice-box -
// Babylon.js and a physics engine, a few hundred KB) is only ever downloaded
// the first time someone opens the tray, not as part of the site's main
// bundle.
export function DiceTray() {
    const colorContext = diceColorContext(useLocation().pathname);
    const relevant = Boolean(colorContext);
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState('idle'); // idle | loading | ready | error
    const [pool, setPool] = useState(emptyPool);
    const [modifier, setModifier] = useState(0);
    const [results, setResults] = useState([]);
    const [rolling, setRolling] = useState(false);
    // null until something is actually saved for this character/campaign -
    // see fallbackColor above for why that, not a computed default, is this
    // state's initial value.
    const [savedColor, setSavedColor] = useState(null);
    // Unused otherwise - just something to flip once the fetch below settles,
    // to force the one extra render that lets fallbackColor() (re-read fresh
    // every render, see above) pick up the real theme colour on a character
    // or campaign with nothing saved, rather than freezing at whatever it
    // read on the very first render.
    const [, forceRender] = useState(false);
    const [colorPickerOpen, setColorPickerOpen] = useState(false);
    const [draftColor, setDraftColor] = useState(fallbackColor);
    const [colorError, setColorError] = useState('');
    const boxRef = useRef(null);
    const diceColor = savedColor ?? fallbackColor();

    // Leaving a character sheet or director view closes the tray, so it
    // doesn't just sit open-but-hidden and reappear already open somewhere
    // unrelated later.
    useEffect(() => {
        if (!relevant) setOpen(false);
    }, [relevant]);

    // The colour tied to this character or campaign (see diceColorContext),
    // read once whenever the tray moves to a different one - `diceColor`
    // keeps falling back to the theme's accent (see above) while this is
    // still null, whether that's because nothing was ever saved or the read
    // just hasn't resolved yet.
    useEffect(() => {
        if (!colorContext) return undefined;
        let cancelled = false;
        getDoc(doc(db, colorContext.collection, colorContext.id)).then(snapshot => {
            if (cancelled) return;
            const saved = snapshot.data()?.dice_color;
            if (saved) setSavedColor(saved);
            else forceRender(current => !current);
        }).catch(error => console.log("Couldn't load the dice colour: " + error));
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately the id/collection, not the colorContext object itself, which is a new object every render (diceColorContext isn't memoized) and would re-run this on every render rather than only when the character/campaign it points to actually changes.
    }, [colorContext?.collection, colorContext?.id]);

    // Applies a colour change to dice already on the stage - covers both the
    // saved colour above arriving after the box is already up, and picking a
    // new one live (see saveColor). A colour picked before the box exists
    // yet still reaches it, just via the constructor call below instead.
    useEffect(() => {
        if (status === 'ready') boxRef.current?.updateConfig({ themeColor: diceColor });
    }, [diceColor, status]);

    useEffect(() => {
        // Deliberately depends on `open` alone, not `status`: setStatus below
        // is itself what would put `status` in the dependency array, which
        // would re-run this effect (and, on the way, run this same
        // invocation's cleanup, marking it cancelled) before the dynamic
        // import a few lines down ever gets a chance to resolve.
        if (!open || boxRef.current) return undefined;
        let cancelled = false;
        setStatus('loading');
        import('@3d-dice/dice-box').then(async ({ default: DiceBox }) => {
            if (cancelled) return;
            const box = new DiceBox(`#${STAGE_ID}`, { assetPath: ASSET_PATH, themeColor: diceColor, scale: DICE_SCALE });
            await box.init();
            if (cancelled) return;
            boxRef.current = box;
            setStatus('ready');
        }).catch(error => {
            console.log("Couldn't load the dice tray: " + error);
            if (!cancelled) setStatus('error');
        });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- diceColor is deliberately read once, at construction; see saveColor and the updateConfig effect above for how a later change still reaches an already-open box.
    }, [open]);

    async function saveColor(color) {
        setColorError('');
        // Only applied once the write actually succeeds - the panel stays
        // open with the error otherwise, the same as a failed roll leaves
        // the tray as it was rather than pretending it worked.
        if (colorContext) {
            try {
                await updateDoc(doc(db, colorContext.collection, colorContext.id), { dice_color: color });
            } catch (error) {
                setColorError("Couldn't save the dice colour: " + error.message);
                return;
            }
        }
        setSavedColor(color);
        setColorPickerOpen(false);
    }

    async function addDie(sides) {
        if (!boxRef.current || rolling) return;
        setRolling(true);
        try {
            const notation = `1d${sides}`;
            const rolled = poolCount(pool) === 0 ? await boxRef.current.roll(notation) : await boxRef.current.add(notation);
            setPool(current => ({ ...current, [sides]: (current[sides] || 0) + 1 }));
            setResults(current => [...current, ...rolled]);
        } catch (error) {
            console.log("Couldn't roll: " + error);
        }
        setRolling(false);
    }

    function clearTray() {
        boxRef.current?.clear();
        setPool(emptyPool());
        setModifier(0);
        setResults([]);
    }

    const hasDice = poolCount(pool) > 0;
    const total = grandTotal(results, modifier);

    return <>
        <button
            type="button"
            className={relevant ? 'DiceTray-toggle' : 'DiceTray-toggle DiceTray-toggle-hidden'}
            aria-expanded={open}
            aria-label="Dice tray"
            tabIndex={relevant ? 0 : -1}
            onClick={() => setOpen(current => !current)}
        >
            🎲
        </button>

        {/* Always mounted, visibility toggled by class rather than by
            conditionally rendering it - closing the tray must not unmount
            #DiceTray-stage, or the DiceBox instance kept in boxRef would be
            left pointing at a canvas React just tore out from under it,
            breaking the tray for the rest of the session. Only the 3D
            library's dynamic import (below) is actually deferred until the
            first open. */}
        <div className={open && relevant ? 'DiceTray' : 'DiceTray DiceTray-closed'} role="region" aria-label="Dice tray">
            <div className="DiceTray-header">
                <span className="DiceTray-title">Dice Tray</span>
                <button
                    type="button"
                    className="DiceTray-color-button"
                    style={{ '--dice-tray-swatch': diceColor }}
                    aria-label="Change dice colour"
                    aria-expanded={colorPickerOpen}
                    onClick={() => { setDraftColor(diceColor); setColorError(''); setColorPickerOpen(current => !current); }}
                />
                <button type="button" className="DiceTray-close" aria-label="Close the dice tray" onClick={() => setOpen(false)}>×</button>
            </div>

            {colorPickerOpen && <div className="DiceTray-color-panel">
                <HexColorPicker className="DiceTray-color-picker" color={draftColor} onChange={setDraftColor}/>
                {colorError && <div className="DiceTray-error" role="alert">{colorError}</div>}
                <div className="DiceTray-color-actions">
                    <button type="button" className="DiceTray-color-save" onClick={() => saveColor(draftColor)}>Set colour</button>
                    <button type="button" className="DiceTray-color-cancel" onClick={() => setColorPickerOpen(false)}>Cancel</button>
                </div>
            </div>}

            <div id={STAGE_ID} className="DiceTray-stage">
                {status === 'loading' && <div className="DiceTray-hint">Loading dice…</div>}
                {status === 'error' && <div className="DiceTray-error" role="alert">Couldn't load the dice tray. Try again in a moment.</div>}
            </div>

            <div className="DiceTray-picker" role="group" aria-label="Add a die">
                {DIE_SIDES.map(sides => <button
                    type="button"
                    key={sides}
                    className="DiceTray-die-button"
                    disabled={status !== 'ready' || rolling}
                    onClick={() => addDie(sides)}
                >
                    {`d${sides}`}
                    {pool[sides] > 0 && <span className="DiceTray-die-count">×{pool[sides]}</span>}
                </button>)}
            </div>

            <div className="DiceTray-modifier">
                <span className="DiceTray-modifier-label">Modifier</span>
                <button type="button" className="DiceTray-modifier-step" aria-label="Decrease modifier" onClick={() => setModifier(current => current - 1)}>−</button>
                <span className="DiceTray-modifier-value">{modifier > 0 ? `+${modifier}` : modifier}</span>
                <button type="button" className="DiceTray-modifier-step" aria-label="Increase modifier" onClick={() => setModifier(current => current + 1)}>+</button>
            </div>

            <div className="DiceTray-result" aria-live="polite">
                {hasDice
                    ? <>
                        <span className="DiceTray-total">{total}</span>
                        <span className="DiceTray-breakdown">{breakdownText(results, modifier)}</span>
                    </>
                    : <span className="DiceTray-hint">Click a die below to roll it.</span>}
            </div>

            <button type="button" className="DiceTray-clear" onClick={clearTray} disabled={!hasDice}>Clear</button>
        </div>
    </>;
}
