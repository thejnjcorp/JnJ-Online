import { COLORS, SIZES } from '../utils/mapDrawing';
import '../styles/MapDrawing.scss';

// A director's drawing tools for the combat map. `drawing` is what
// useMapDrawing returns. While drawing is off the map behaves as it always did
// (tokens can be dragged); turning it on lets the pen and eraser take over.
export function MapDrawingToolbar({ drawing }) {
    const { active, setActive, tool, setTool, color, setColor, size, setSize, strokes, fullness, full, undo, clear } = drawing;
    return <div className="MapDrawingToolbar" role="toolbar" aria-label="Map drawing tools">
        <button type="button" className="MapDrawingToolbar-button" aria-pressed={active} onClick={() => setActive(!active)}>{active ? 'Stop drawing' : 'Draw on map'}</button>
        {active && <>
            <div className="MapDrawingToolbar-group" role="group" aria-label="Tool">
                <button type="button" className="MapDrawingToolbar-button" aria-pressed={tool === 'pen'} onClick={() => setTool('pen')}>Pen</button>
                <button type="button" className="MapDrawingToolbar-button" aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')}>Eraser</button>
            </div>
            {tool === 'pen' && <>
                <div className="MapDrawingToolbar-group" role="group" aria-label="Color">
                    {COLORS.map(swatch => <button
                        key={swatch.key}
                        type="button"
                        className="MapDrawingToolbar-swatch"
                        style={{ backgroundColor: swatch.value }}
                        aria-label={swatch.label}
                        aria-pressed={color === swatch.value}
                        onClick={() => setColor(swatch.value)}
                    />)}
                    <input type="color" className="MapDrawingToolbar-custom" aria-label="Custom color" value={color} onChange={event => setColor(event.target.value)}/>
                </div>
                <div className="MapDrawingToolbar-group" role="group" aria-label="Line width">
                    {SIZES.map(option => <button key={option.key} type="button" className="MapDrawingToolbar-button" aria-pressed={size === option.value} onClick={() => setSize(option.value)}>{option.label}</button>)}
                </div>
            </>}
            <div className="MapDrawingToolbar-group">
                <button type="button" className="MapDrawingToolbar-button" disabled={strokes.length === 0} onClick={undo}>Undo</button>
                <button type="button" className="MapDrawingToolbar-button" disabled={strokes.length === 0} onClick={clear}>Clear all</button>
            </div>
            {full
                ? <span className="MapDrawingToolbar-note MapDrawingToolbar-note-full" role="alert">The drawing is full - erase or clear some to draw more.</span>
                : fullness >= 0.7 && <span className="MapDrawingToolbar-note">{Math.round(fullness * 100)}% of the drawing space used.</span>}
        </>}
    </div>;
}
