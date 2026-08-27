// Pure useReducer reducer for NewCharacterPage.js's formData state (also
// reused by SkillsAndFlaws.js - see its import). Pulled out of the
// component so it can be unit tested without dragging in
// Firebase/router/CSS imports.
export const newCharacterFormReducer = (state, event) => {
    if (event.type === 'SET_FORM_DATA') {
        return {
            ...state,
            ...event.payload,
        };
    }
    return {
        ...state,
        [event.name]: event.value
    }
}
