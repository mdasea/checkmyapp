// checkmyapp — config module
// Uses 'conf' package to persist config at ~/.config/checkmyapp/config.json
import Conf from 'conf';

const schema = {
  authToken: {
    type: 'string',
    default: '',
  },
  serverUrl: {
    type: 'string',
    default: 'https://checkmyapp.online',
  },
  lastSubdomain: {
    type: 'string',
    default: '',
  },
};

let _config = null;

/**
 * Get (or lazy-init) the shared Conf instance.
 * @returns {Conf}
 */
export function getConfig() {
  if (!_config) {
    _config = new Conf({
      projectName: 'checkmyapp',
      projectSuffix: '',
      cwd: undefined, // use default OS config directory
      schema,
      defaults: {
        authToken: '',
        serverUrl: 'https://api.checkmyapp.online',
        lastSubdomain: '',
      },
    });
  }
  return _config;
}

/**
 * Retrieve a config value by key.
 * @param {string} key
 * @returns {*}
 */
export function get(key) {
  return getConfig().get(key);
}

/**
 * Set a config value by key.
 * @param {string} key
 * @param {*} value
 */
export function set(key, value) {
  getConfig().set(key, value);
}

/**
 * Delete a config key.
 * @param {string} key
 */
export function deleteKey(key) {
  getConfig().delete(key);
}

/**
 * Clear all stored config.
 */
export function clear() {
  getConfig().clear();
}

/**
 * Get the path to the config file on disk.
 * @returns {string}
 */
export function getConfigPath() {
  return getConfig().path;
}

export default {
  getConfig,
  get,
  set,
  deleteKey,
  clear,
  getConfigPath,
};
