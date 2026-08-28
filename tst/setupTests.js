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
    global.structuredClone = (value) => JSON.parse(JSON.stringify(value));
}
