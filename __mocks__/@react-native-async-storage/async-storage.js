// Auto-applied manual mock so anything importing the persistence layer (and the
// zustand stores built on it) can be loaded in Jest without the native module.
// See https://react-native-async-storage.github.io/async-storage/docs/advanced/jest
module.exports = require('@react-native-async-storage/async-storage/jest/async-storage-mock');
