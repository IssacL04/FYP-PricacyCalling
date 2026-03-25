const { IdentityPolicy } = require('./identity-policy');
const { AppError } = require('../utils/errors');

class ConsistentCalleePolicy extends IdentityPolicy {
  constructor(db) {
    super();
    this.db = db;
  }

  selectVirtualIdentity({ calleeE164 }) {
    const mapped = this.db.getMappedVirtualNumberForCallee(calleeE164);
    if (mapped && this.db.isVirtualNumberAvailable(mapped.id)) {
      return mapped;
    }

    const fallback = this.db.getFirstAvailableVirtualNumber();
    if (!fallback) {
      throw new AppError('No available virtual number in pool', 409, 'virtual_number_exhausted');
    }

    this.db.upsertMapping(calleeE164, fallback.id);
    return fallback;
  }
}

module.exports = {
  ConsistentCalleePolicy
};
