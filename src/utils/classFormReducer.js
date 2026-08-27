// Pure useReducer reducer for ClassPage.js's formData state. Pulled out of
// the component so it (and the dotted-path navigation it relies on) can be
// unit tested without dragging in Firebase/router/CSS imports.

// Descends one dotted-path segment (e.g. "actions[0]" or "tagInfo") into the
// nested form-data object formReducer is building, creating any missing
// array/object along the way, and returns the object to descend into next.
export function navigateFormDataKey(currentObject, key, isLast) {
    // If the key contains an array index (e.g., "actions[0]")
    const arrayMatch = key.match(/(\w+)\[(\d+)\]/);
    if (arrayMatch) {
        const arrayName = arrayMatch[1]; // Array name, like 'actions'
        const arrayIndex = Number.parseInt(arrayMatch[2], 10); // Index, like 0 or 1

        // Ensure the array (and the item at that index) exist, then move down to it
        if (!currentObject[arrayName]) currentObject[arrayName] = [];
        if (!currentObject[arrayName][arrayIndex]) currentObject[arrayName][arrayIndex] = {};
        return currentObject[arrayName][arrayIndex];
    }

    // A regular object property (e.g., "tags" or "tagInfo")
    if (!currentObject[key]) currentObject[key] = {}; // Initialize if the key doesn't exist yet
    return isLast ? currentObject : currentObject[key];
}

export const classFormReducer = (state, event) => {
    if (event.type === 'SET_FORM_DATA') {
        return {
            ...state,
            ...event.payload,
        };
    }
    const { name, value } = event;
    const arrayRegex = /(\w+)\[(\d+)\](\.\w+|\[\d+\])*/g;
    const newState = { ...state };

    if (!arrayRegex.test(name)) {
        // If there are no arrays or nested objects, handle the flat properties
        return {
            ...state,
            [name]: value
        };
    }

    const keys = name.split('.');
    let currentObject = newState;
    keys.forEach((key, index) => {
        currentObject = navigateFormDataKey(currentObject, key, index === keys.length - 1);
    });

    // Set the final value
    currentObject[keys[keys.length - 1]] = value;
    return newState;
};
