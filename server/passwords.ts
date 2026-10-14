import { randomBytes, scrypt as scryptCb, timingSafeEqual, type BinaryLike, type ScryptOptions } from 'node:crypto';
import type { PasswordHasher } from '../src/mock-server/crypto';

const scrypt = (pw: BinaryLike, salt: BinaryLike, len: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(pw, salt, len, opts, (err, key) => (err ? reject(err) : resolve(key))));

const PARAMS = { N: 16384, r: 8, p: 1 };

/** Băm mật khẩu bằng scrypt (NFR05). Định dạng: scrypt$N$r$p$salt$hash (base64). */
export const scryptHasher: PasswordHasher = {
  async hash(password) {
    const salt = randomBytes(16);
    const key = await scrypt(password, salt, 64, PARAMS);
    return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${key.toString('base64')}`;
  },
  async verify(password, stored) {
    if (!stored.startsWith('scrypt$')) return null;
    const [, N, r, p, saltB64, hashB64] = stored.split('$');
    const expected = Buffer.from(hashB64, 'base64');
    const key = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
    return timingSafeEqual(key, expected);
  },
};
