import { useState, useRef, createRef } from "react"
import Draggable from "react-draggable";
import { HexColorPicker } from "react-colorful";
import colorpickerIcon from '../icons/colorpicker.svg';
import "../styles/MapRenderer.scss";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../utils/firebase";


export function MapRenderer({ map, userId }) {
    const [isEditing, setIsEditing] = useState(false);
    const [mapBorderColor, setMapBorderColor] = useState(map?.borderColor || "red");
    const [zones, setZones] = useState(map?.zones || []);
    const canEdit = map?.canWrite.includes(userId);
    const [selectedZone, setSelectedZone] = useState(null);

    const [showColorpicker, setShowColorPicker] = useState(false);
    const [selectedColor, setSelectedColor] = useState(map?.borderColor || "red");
    const nodeRefs = useRef([]);

    function changeColor() {
        setMapBorderColor(selectedColor);
        setShowColorPicker(false);
    }

    const startResizing = (e, index, direction) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        const zone = zones[index];

        const handleMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            setZones(prev => {
                const updated = [...prev];
                const z = { ...updated[index] };

                if (direction.includes("right")) {
                    z.width = Math.max(20, zone.width + dx);
                }
                if (direction.includes("left")) {
                    z.width = Math.max(20, zone.width - dx);
                    z.x = zone.x + dx;
                }
                if (direction.includes("bottom")) {
                    z.height = Math.max(20, zone.height + dy);
                }
                if (direction.includes("top")) {
                    z.height = Math.max(20, zone.height - dy);
                    z.y = zone.y + dy;
                }

                updated[index] = z;
                return updated;
            });
        };

        const handleMouseUp = () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    };

    return <div className="MapRenderer">
        <div className="MapRenderer-header">
            {canEdit && <button className="MapRenderer-button" onClick={() => setIsEditing(!isEditing)}>{isEditing ? "Stop Editing" : "Edit"}</button>}
            {isEditing && <button className="MapRenderer-button" onClick={() => setZones(prev => [
                ...prev,
                {
                    name: "Zone " + (prev.length + 1),
                    x: 10,
                    y: 10,
                    width: 100,
                    height: 100
                }
            ])}>Add Zone</button>}
            {isEditing && <button className="MapRenderer-button" onClick={() => {
                if (selectedZone !== null) {
                    setZones(prev => prev.filter((_, index) => index !== selectedZone));
                    setSelectedZone(null);
                }
            }}>Remove Zone</button>}
            {isEditing && <button className="MapRenderer-color-picker-button" onClick={() => setShowColorPicker(!showColorpicker)}>
                <img src={colorpickerIcon} className="MapRenderer-colorpicker" alt="colorpicker.svg"/> 
            </button>}
            {isEditing && showColorpicker && <div className="MapRenderer-colorpicker-panel">
                <div>
                    <button className="MapRenderer-colorpicker-quick-select-button" 
                    style={{background: map?.borderColor || "red"}}
                    onClick={() => setSelectedColor(map?.borderColor || "red")}/>
                </div>
                <HexColorPicker className="MapRenderer-colorpicker-actual" color={selectedColor} onChange={setSelectedColor}/>
                <button className="MapRenderer-colorpicker-select-button" onClick={() => changeColor()}>set color</button>
            </div>}
            {isEditing && <button className="MapRenderer-button" onClick={() => {
                updateDoc(doc(db, "maps", map.map_id), {
                    borderColor: mapBorderColor,
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

        <img src={map.link} alt="map" width={500}/>
        {zones.map((zone, index) => {
            if (!nodeRefs.current[index]) nodeRefs.current[index] = createRef();
            return <Draggable key={index}
                nodeRef={nodeRefs.current[index]}
                defaultPosition={{x: zone.x, y: zone.y}}
                position={{x: zone.x, y: zone.y}}
                bounds="parent"
                onStop={(_, data) => {
                    setZones(prev => {
                        const newZones = [...prev];
                        newZones[index] = {
                            ...newZones[index],
                            x: data.x,
                            y: data.y
                        };
                        return newZones;
                    });
                }}
                disabled={!isEditing}
            >
                <div
                    style={{
                        width: zone.width, 
                        height: zone.height,
                        borderColor: mapBorderColor,
                        zIndex: selectedZone === index ? 999 : index
                    }}
                    className="MapRenderer-zone"
                    ref={nodeRefs.current[index]}
                >
                    <input
                        className="MapRenderer-zone-name"
                        style={{ width: zone.width - 10, height: zone.height - 10 }}
                        type="text"
                        value={zone.name}
                        onChange={(e) => {
                            setZones(prev => {
                                const newZones = [...prev];
                                newZones[index] = {
                                    ...newZones[index],
                                    name: e.target.value
                                };
                                return newZones;
                            });
                        }}
                        onMouseDown={() => setSelectedZone(index)}
                        disabled={!isEditing}
                    />
                    {isEditing && <div className="resizer top-left" onMouseDown={(e) => startResizing(e, index, "top-left")}/>}
                    {isEditing && <div className="resizer top" onMouseDown={(e) => startResizing(e, index, "top")}/>}
                    {isEditing && <div className="resizer top-right" onMouseDown={(e) => startResizing(e, index, "top-right")}/>}
                    {isEditing && <div className="resizer right" onMouseDown={(e) => startResizing(e, index, "right")}/>}
                    {isEditing && <div className="resizer bottom-right" onMouseDown={(e) => startResizing(e, index, "bottom-right")}/>}
                    {isEditing && <div className="resizer bottom" onMouseDown={(e) => startResizing(e, index, "bottom")}/>}
                    {isEditing && <div className="resizer bottom-left" onMouseDown={(e) => startResizing(e, index, "bottom-left")}/>}
                    {isEditing && <div className="resizer left" onMouseDown={(e) => startResizing(e, index, "left")}/>}
                </div>
            </Draggable>
        })}
    </div>
}