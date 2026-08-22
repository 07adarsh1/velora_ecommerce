// Wraps async controllers so a rejected promise is forwarded to the
// centralized errorHandler instead of crashing the process (PRD §6.2).
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
