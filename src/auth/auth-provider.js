class AuthProvider {
  // eslint-disable-next-line class-methods-use-this
  authenticate() {
    throw new Error('authenticate() must be implemented by subclasses');
  }
}

module.exports = {
  AuthProvider
};
