// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

if (!navigator.mediaDevices) {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {},
    configurable: true,
  });
}

navigator.mediaDevices.getUserMedia = jest.fn(() =>
  Promise.resolve({
    getTracks: () => [],
  })
);

HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  drawImage: jest.fn(),
}));

HTMLCanvasElement.prototype.toDataURL = jest.fn(
  () => 'data:image/jpeg;base64,test'
);

Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
  configurable: true,
  set() {},
});
