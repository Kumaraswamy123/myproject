import crypto from 'node:crypto';

export function now() {
  return new Date().toISOString();
}

export function createId(prefix = 'id') {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto
    .createHash('sha256')
    .update(`${salt}:${password}`)
    .digest('hex');

  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }

  const [salt] = storedHash.split(':');
  return hashPassword(password, salt) === storedHash;
}
