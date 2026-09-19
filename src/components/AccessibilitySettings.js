import { useEffect } from 'react';
import { useAccessibility } from '../utils/AccessibilityContext';
import { READING_FONTS, TEXT_SCALES, TOGGLES, ensureFontLoaded, isDefaultSettings } from '../utils/accessibility';
import '../styles/AccessibilitySettings.scss';

const SAVE_MESSAGES = {
    saving: 'Saving…',
    saved: 'Saved to your account - these follow you to every device.',
    error: "Couldn't save to your account. Your changes still apply on this device.",
};

// The "Reading & vision" section of the account page. Every change applies to
// the whole site straight away (the page you're looking at is the preview).
export function AccessibilitySettings() {
    const { settings, saveState, update, reset } = useAccessibility();

    // So each font option can be shown in its own typeface.
    useEffect(() => {
        READING_FONTS.forEach(font => ensureFontLoaded(font.key));
    }, []);

    return <section className="AccountPage-section AccessibilitySettings" aria-labelledby="a11y-heading">
        <div className="AccountPage-section-header">
            <h2 id="a11y-heading">Reading &amp; vision</h2>
            <button
                type="button"
                className="AccessibilitySettings-reset"
                onClick={reset}
                disabled={isDefaultSettings(settings)}
            >Reset to defaults</button>
        </div>
        <p className="AccessibilitySettings-intro">
            Make the site easier to read. Changes apply everywhere as soon as you pick them.
        </p>

        <div className="AccessibilitySettings-group" role="radiogroup" aria-labelledby="a11y-size-label">
            <div className="AccessibilitySettings-label" id="a11y-size-label">Text size</div>
            <div className="AccessibilitySettings-choices">
                {TEXT_SCALES.map(scale => <button
                    key={scale.value}
                    type="button"
                    role="radio"
                    aria-checked={settings.textScale === scale.value}
                    className={settings.textScale === scale.value ? 'AccessibilitySettings-choice AccessibilitySettings-choice-selected' : 'AccessibilitySettings-choice'}
                    onClick={() => update({ textScale: scale.value })}
                >{scale.label}</button>)}
            </div>
        </div>

        <div className="AccessibilitySettings-group" role="radiogroup" aria-labelledby="a11y-font-label">
            <div className="AccessibilitySettings-label" id="a11y-font-label">Font</div>
            <div className="AccessibilitySettings-choices">
                {READING_FONTS.map(font => <button
                    key={font.key}
                    type="button"
                    role="radio"
                    aria-checked={settings.font === font.key}
                    className={settings.font === font.key ? 'AccessibilitySettings-choice AccessibilitySettings-choice-selected' : 'AccessibilitySettings-choice'}
                    style={font.family ? { fontFamily: font.family } : undefined}
                    onClick={() => update({ font: font.key })}
                >{font.label}</button>)}
            </div>
        </div>

        <div className="AccessibilitySettings-toggles">
            {TOGGLES.map(toggle => <label key={toggle.key} className="AccessibilitySettings-toggle">
                <input
                    type="checkbox"
                    checked={settings[toggle.key]}
                    onChange={event => update({ [toggle.key]: event.target.checked })}
                />
                <span>
                    <span className="AccessibilitySettings-toggle-title">{toggle.label}</span>
                    <span className="AccessibilitySettings-toggle-hint">{toggle.hint}</span>
                </span>
            </label>)}
        </div>

        <div className="AccessibilitySettings-sample">
            <div className="AccessibilitySettings-label">Preview</div>
            <p>
                <em>The wind carries the smell of smoke.</em> Make a Strength Save against your Class DC.
                On a failure, the target takes 1d6 + 1 Fire Damage and gains Sickened 2.
            </p>
        </div>

        <div className="AccessibilitySettings-status" role="status" aria-live="polite">
            {SAVE_MESSAGES[saveState] || ''}
        </div>
    </section>;
}
