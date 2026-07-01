const fs = require('fs');
const path = require('path');

// Mock DOM
global.window = {
  location: { hostname: 'localhost' }
};

const mockElement = {
  addEventListener: () => {},
  appendChild: () => {},
  options: [{ text: 'mock' }],
  selectedIndex: 0,
  classList: {
    add: () => {},
    remove: () => {}
  },
  style: {},
  querySelector: () => null,
  querySelectorAll: () => []
};

global.document = {
  getElementById: (id) => {
    console.log('document.getElementById:', id);
    return mockElement;
  },
  querySelectorAll: (query) => {
    console.log('document.querySelectorAll:', query);
    return [];
  },
  createElement: (tag) => {
    console.log('document.createElement:', tag);
    return mockElement;
  },
  addEventListener: () => {}
};

global.fetch = () => Promise.resolve({
  status: 200,
  ok: true,
  json: () => Promise.resolve([])
});

global.AudioContext = function() {
  return {
    createOscillator: () => ({
      connect: () => {},
      start: () => {},
      stop: () => {}
    }),
    createGain: () => ({
      connect: () => {},
      gain: { value: 0 }
    }),
    state: 'suspended',
    resume: () => Promise.resolve()
  };
};

global.setInterval = () => {};
global.setTimeout = () => {};

// Read and execute manager.js
const code = fs.readFileSync(path.join(__dirname, '../public/js/manager.js'), 'utf8');

try {
  console.log('--- Executing manager.js ---');
  eval(code);
  console.log('--- Execution finished successfully! ---');
} catch (e) {
  console.error('--- Execution failed with error: ---');
  console.error(e);
}
