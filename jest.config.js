// Independent Jest config for tst/, which mirrors src/'s directory
// structure. react-scripts' own test runner (`npm test`) only ever looks
// inside src/ (that's hard-coded in react-scripts, not something
// package.json's "jest" field can override without ejecting), so this
// config runs separately via `npm run test:tst`.
//
// Reuses react-scripts' own babel/css/file transforms so JSX, TypeScript,
// and non-JS imports are handled identically to the app's real build - no
// duplicated/drifting babel config to maintain.

module.exports = {
    rootDir: __dirname,
    // src is included alongside tst so collectCoverageFrom can see every
    // src/ file (and report 0% for untested ones) - testMatch below still
    // scopes actual test discovery to tst/ only, so this doesn't start
    // picking up src/App.test.js or anything else under src/.
    roots: ['<rootDir>/tst', '<rootDir>/src'],
    testMatch: ['<rootDir>/tst/**/*.test.{js,jsx,ts,tsx}'],
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/tst/setupTests.js'],
    transform: {
        '^.+\\.(js|jsx|mjs|cjs|ts|tsx)$': require.resolve('react-scripts/config/jest/babelTransform.js'),
        '^.+\\.css$': require.resolve('react-scripts/config/jest/cssTransform.js'),
        '^(?!.*\\.(js|jsx|mjs|cjs|ts|tsx|css|json)$)': require.resolve('react-scripts/config/jest/fileTransform.js'),
    },
    transformIgnorePatterns: [
        String.raw`[/\\]node_modules[/\\].+\.(js|jsx|mjs|cjs|ts|tsx)$`,
        String.raw`^.+\.module\.(css|sass|scss)$`,
    ],
    moduleFileExtensions: ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'json', 'node'],
    moduleNameMapper: {
        '^react-native$': 'react-native-web',
        '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',
        '^react-router/dom$': 'react-router/dist/development/dom-export.js',
    },
    resetMocks: true,
    // Coverage is measured against all of src/, not just the files tst/
    // currently covers - that's deliberate: it's what sonar-project.properties
    // points Sonar's coverage metric at (see scripts/sonar-scan.sh), so it
    // should read as "how much of the app tst/ actually covers today",
    // honestly low until more of src/ gets tests, not an inflated number
    // scoped to only what's already tested.
    collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/**/*.d.ts'],
    coverageDirectory: 'coverage/tst',
    coverageReporters: ['lcov', 'text-summary'],
};
