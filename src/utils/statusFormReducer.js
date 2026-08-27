// Pure useReducer reducer for StatusPage.js's formData state - pulled out
// of the component so it can be unit tested without dragging in
// Firebase/router/CSS imports.
export const statusFormReducer = (state, event) => {
    if (event.type === 'SET_FORM_DATA') {
        return { ...state, ...event.payload };
    }
    return { ...state, [event.name]: event.value };
};
