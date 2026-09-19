// Mirrors src/setupTests.js (the setup react-scripts test loads
// automatically) - loaded here via jest.config.js's setupFilesAfterEnv
// since this config isn't managed by react-scripts.

// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jsdom's test environment doesn't expose TextEncoder/TextDecoder, which react-router needs.
import { TextEncoder, TextDecoder } from 'node:util';
Object.assign(global, { TextEncoder, TextDecoder });

// jsdom's test environment doesn't expose structuredClone either, unlike every real browser.
if (typeof global.structuredClone !== 'function') {
    global.structuredClone = (value) => JSON.parse(JSON.stringify(value)); // NOSONAR - this *is* the structuredClone fallback, only reached when the real one is missing, so calling structuredClone here would be circular.
}

// jsdom has no layout, so it doesn't implement scrollIntoView. Tests that care
// about scrolling replace this with a jest.fn() of their own.
if (typeof window !== 'undefined' && typeof window.HTMLElement.prototype.scrollIntoView !== 'function') {
    window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
}

// The rich-text editor can't run in jsdom (it is a contenteditable), and it is
// lazy-loaded, so tests of the pages that use it get this plain textarea with
// the same props. tst/components/MarkdownEditor.test.js tests the real wrapper.
jest.mock('../src/components/MarkdownEditor', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: function MarkdownEditorStandIn({ value, onChange, label, placeholder, readOnly, maxLength, variant }) {
            return React.createElement('textarea', {
                'aria-label': label,
                'data-variant': variant,
                placeholder,
                readOnly,
                maxLength,
                value: value || '',
                onChange: event => onChange(event.target.value),
            });
        },
    };
});
