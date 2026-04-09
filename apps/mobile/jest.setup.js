// Stub native-only modules that jest-expo's jsdom-ish environment can't load.
// Keep this file tiny — if a module is flaky in a specific test, mock it there.

// Silence noisy logs from react-native internals during tests.
jest.spyOn(console, 'warn').mockImplementation(() => {})
