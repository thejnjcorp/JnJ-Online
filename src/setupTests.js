// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jsdom's test environment doesn't expose TextEncoder/TextDecoder, which react-router needs.
import { TextEncoder, TextDecoder } from 'node:util';
Object.assign(global, { TextEncoder, TextDecoder });
