class IdentityPolicy {
  // eslint-disable-next-line class-methods-use-this
  selectVirtualIdentity() {
    throw new Error('selectVirtualIdentity() must be implemented by subclasses');
  }
}

module.exports = {
  IdentityPolicy
};
