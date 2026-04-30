import { customAlphabet } from 'nanoid';

const alphabet = 'ABCDEFGHJKMNPQRSTVWXYZabcdefghjkmnpqrstvwxyz23456789';

export const inviteCode = customAlphabet(alphabet, 8);
export const fileKey = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 24);
