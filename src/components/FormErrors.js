import { prefersReducedMotion } from '../utils/accessibility';
import '../styles/ClassPage.scss';

// Props to spread onto an input (or the wrapper of a pill group) so a
// validation error shows up on it: a red outline, aria-invalid, and the
// data-problem marker ValidationSummary / scrollToFirstProblem look for.
export function invalidProps(problemId, message) {
    return message ? { 'aria-invalid': true, 'data-problem': problemId } : {};
}

export function invalidClass(baseClass, message) {
    return message ? `${baseClass} ClassPage-field-input-invalid` : baseClass;
}

export function FieldError({ message }) {
    return message ? <div className="ClassPage-field-error" role="alert">{message}</div> : null;
}

function findProblemElement(problemId) {
    return Array.from(document.querySelectorAll('[data-problem]')).find(element => element.getAttribute('data-problem') === problemId);
}

// Scrolls to (and focuses, when it can be) the problem with this id, or the
// first problem on the page when none is given.
export function scrollToProblem(problemId) {
    const element = problemId ? findProblemElement(problemId) : document.querySelector('[data-problem]');
    if (!element) return;
    element.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    if (typeof element.focus === 'function') element.focus({ preventScroll: true });
}

// The list at the top of the page after a save attempt fails: every problem,
// each one a button that jumps to the field.
export function ValidationSummary({ problems }) {
    if (problems.length === 0) return null;
    return <div className="ClassPage-validation-summary" role="alert">
        <div className="ClassPage-validation-summary-title">
            {problems.length === 1 ? '1 thing to fix before saving' : `${problems.length} things to fix before saving`}
        </div>
        <ul>
            {problems.map(problem => <li key={problem.id}>
                <button type="button" onClick={() => scrollToProblem(problem.id)}>
                    <strong>{problem.label}</strong> {problem.message}
                </button>
            </li>)}
        </ul>
    </div>;
}
