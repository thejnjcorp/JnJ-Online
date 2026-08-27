import { useState, useRef } from "react"
import Draggable from "react-draggable";
import { HexColorPicker } from "react-colorful";
import colorpickerIcon from '../icons/colorpicker.svg';
import "../styles/MapRenderer.scss";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../utils/firebase";

const RESIZE_STEP = 5;

export function MapRenderer({ map, userId }) {
    const [isEditing, setIsEditing] = useState(false);
    const [mapBorderColor, setMapBorderColor] = useState(map?.borderColor || "red");
    // Legacy zones saved before zones had a stable id get one assigned here,
    // on load - everything below (refs, drag/resize, selection) identifies a
    // zone by id rather than array position, so removing or reordering a
    // zone can't scramble another zone's ref or in-progress drag.
    const [zones, setZones] = useState((map?.zones || []).map(zone => zone.id ? zone : { ...zone, id: crypto.randomUUID() }));
    const canEdit = map?.canWrite?.includes(userId);
    const [selectedZoneId, setSelectedZoneId] = useState(null);

    const [showColorPicker, setShowColorPicker] = useState(false);
    const [selectedColor, setSelectedColor] = useState(map?.borderColor || "red");
    const [zoneTextColor, setZoneTextColor] = useState(map?.zoneTextColor || "white");
    const [showTextColorPicker, setShowTextColorPicker] = useState(false);
    const [selectedTextColor, setSelectedTextColor] = useState(map?.zoneTextColor || "white");
    const nodeRefs = useRef({});

    // monotonic, never reused even across clear/remove - avoids naming a new zone
    // the same as one that still exists elsewhere in the array, since "Zone " + length
    // only reflects the current count, not what names are actually taken
    const zoneCounterRef = useRef((map?.zones || []).reduce((max, zone) => {
        const match = /^Zone (\d+)$/.exec(zone.name);
        return match ? Math.max(max, Number.parseInt(match[1], 10)) : max;
    }, 0));

    function changeColor() {
        setMapBorderColor(selectedColor);
        setShowColorPicker(false);
    }

    function changeTextColor() {
        setZoneTextColor(selectedTextColor);
        setShowTextColorPicker(false);
    }

    // Pure edge-specific math, shared by mouse-drag resizing and the resize
    // handles' keyboard support - given a base zone snapshot and a delta,
    // returns the resized zone.
    const applyResizeDelta = (baseZone, direction, dx, dy) => {
        const updated = { ...baseZone };
        if (direction.includes("right")) {
            updated.width = Math.max(20, baseZone.width + dx);
        }
        if (direction.includes("left")) {
            updated.width = Math.max(20, baseZone.width - dx);
            updated.x = baseZone.x + dx;
        }
        if (direction.includes("bottom")) {
            updated.height = Math.max(20, baseZone.height + dy);
        }
        if (direction.includes("top")) {
            updated.height = Math.max(20, baseZone.height - dy);
            updated.y = baseZone.y + dy;
        }
        return updated;
    };

    const startResizing = (e, zoneId, direction) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        const baseZone = zones.find(z => z.id === zoneId);

        const handleMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            setZones(prev => prev.map(z => z.id === zoneId ? applyResizeDelta(baseZone, direction, dx, dy) : z));
        };

        const handleMouseUp = () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    };

    const handleResizerKeyDown = (e, zoneId, direction) => {
        const deltas = {
            ArrowRight: [RESIZE_STEP, 0],
            ArrowLeft: [-RESIZE_STEP, 0],
            ArrowDown: [0, RESIZE_STEP],
            ArrowUp: [0, -RESIZE_STEP],
        };
        const delta = deltas[e.key];
        if (!delta) return;
        e.preventDefault();
        // Each key press is its own independent nudge (unlike a mouse drag's
        // cumulative delta from one start point), so this builds on the
        // current size rather than a fixed snapshot.
        setZones(prev => prev.map(z => z.id === zoneId ? applyResizeDelta(z, direction, delta[0], delta[1]) : z));
    };

    return <div className="MapRenderer">
        <div className="MapRenderer-header">
            {canEdit && <button type="button" className="MapRenderer-button" onClick={() => setIsEditing(!isEditing)}>{isEditing ? "Stop Editing" : "Edit"}</button>}
            {isEditing && <button type="button" className="MapRenderer-button" onClick={() => {
                zoneCounterRef.current += 1;
                setZones(prev => [
                    ...prev,
                    {
                        id: crypto.randomUUID(),
                        name: "Zone " + zoneCounterRef.current,
                        x: 10,
                        y: 10,
                        width: 100,
                        height: 100
                    }
                ]);
            }}>Add Zone</button>}
            {isEditing && <button type="button" className="MapRenderer-button" onClick={() => {
                if (selectedZoneId !== null) {
                    setZones(prev => prev.filter(z => z.id !== selectedZoneId));
                    setSelectedZoneId(null);
                }
            }}>Remove Zone</button>}
            {isEditing && zones.length > 0 && <button type="button" className="MapRenderer-button" onClick={() => {
                if (window.confirm("Clear all zones on this map? This isn't saved until you hit Save Map.")) {
                    setZones([]);
                    setSelectedZoneId(null);
                }
            }}>Clear Zones</button>}
            {isEditing && <button type="button" className="MapRenderer-color-picker-button" onClick={() => {
                setShowColorPicker(!showColorPicker);
                setShowTextColorPicker(false);
            }}>
                <img src={colorpickerIcon} className="MapRenderer-colorpicker" alt="colorpicker.svg"/>
            </button>}
            {isEditing && showColorPicker && <div className="MapRenderer-colorpicker-panel">
                <div>
                    <button type="button" className="MapRenderer-colorpicker-quick-select-button"
                    style={{background: map?.borderColor || "red"}}
                    onClick={() => setSelectedColor(map?.borderColor || "red")}/>
                </div>
                <HexColorPicker className="MapRenderer-colorpicker-actual" color={selectedColor} onChange={setSelectedColor}/>
                <button type="button" className="MapRenderer-colorpicker-select-button" onClick={() => changeColor()}>set color</button>
            </div>}
            {isEditing && <button type="button" className="MapRenderer-button" onClick={() => {
                setShowTextColorPicker(!showTextColorPicker);
                setShowColorPicker(false);
            }}>Text Color</button>}
            {isEditing && showTextColorPicker && <div className="MapRenderer-colorpicker-panel">
                <div>
                    <button type="button" className="MapRenderer-colorpicker-quick-select-button"
                    style={{background: map?.zoneTextColor || "white"}}
                    onClick={() => setSelectedTextColor(map?.zoneTextColor || "white")}/>
                </div>
                <HexColorPicker className="MapRenderer-colorpicker-actual" color={selectedTextColor} onChange={setSelectedTextColor}/>
                <button type="button" className="MapRenderer-colorpicker-select-button" onClick={() => changeTextColor()}>set color</button>
            </div>}
            {isEditing && <button type="button" className="MapRenderer-button" onClick={() => {
                updateDoc(doc(db, "maps", map.map_id), {
                    borderColor: mapBorderColor,
                    zoneTextColor: zoneTextColor,
                    zones: zones
                }).then(() => {
                    alert("Map saved successfully!");
                    setIsEditing(false);
                }).catch(error => {
                    console.error("Error saving map:", error);
                    alert("Failed to save map: " + error.message);
                });
            }}>Save Map</button>}
        </div>

        <div className="MapRenderer-canvas">
        <img src={map.link} alt="map" width={500}/>
        {zones.map((zone, index) => {
            if (!nodeRefs.current[zone.id]) nodeRefs.current[zone.id] = { current: null };
            return <Draggable key={zone.id}
                nodeRef={nodeRefs.current[zone.id]}
                defaultPosition={{x: zone.x, y: zone.y}}
                position={{x: zone.x, y: zone.y}}
                bounds="parent"
                onStop={(_, data) => {
                    setZones(prev => prev.map(z => z.id === zone.id ? { ...z, x: data.x, y: data.y } : z));
                }}
                disabled={!isEditing}
            >
                <div
                    style={{
                        width: zone.width,
                        height: zone.height,
                        borderColor: mapBorderColor,
                        zIndex: selectedZoneId === zone.id ? 999 : index
                    }}
                    className="MapRenderer-zone"
                    ref={nodeRefs.current[zone.id]}
                >
                    <input
                        className="MapRenderer-zone-name"
                        style={{ width: zone.width - 10, height: zone.height - 10, color: zoneTextColor }}
                        type="text"
                        value={zone.name}
                        onChange={(e) => {
                            const newName = e.target.value;
                            setZones(prev => prev.map(z => z.id === zone.id ? { ...z, name: newName } : z));
                        }}
                        onMouseDown={() => setSelectedZoneId(zone.id)}
                        disabled={!isEditing}
                    />
                    {isEditing && ["top-left", "top", "top-right", "right", "bottom-right", "bottom", "bottom-left", "left"].map(direction =>
                        <button
                            type="button"
                            key={direction}
                            className={`resizer ${direction}`}
                            aria-label={`Resize zone from ${direction.replace('-', ' ')}`}
                            onMouseDown={(e) => startResizing(e, zone.id, direction)}
                            onKeyDown={(e) => handleResizerKeyDown(e, zone.id, direction)}
                        />
                    )}
                </div>
            </Draggable>
        })}
        </div>
    </div>
}
