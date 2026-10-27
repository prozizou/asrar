const PASSWORD = 'Local-emulator-only-2026!';
const roles = ['free', 'basic', 'premium', 'seller', 'admin', 'expired', 'unverified'];
const accounts = Object.fromEntries(roles.map((role) => [role, {
  uid: 'fixture-' + role, email: role + '@asrar.test', password: PASSWORD,
}]));
module.exports = { accounts };
