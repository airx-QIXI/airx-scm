import type { VercelRequest, VercelResponse } from '@vercel/node';
import { modulesHandler } from '../_lib/module';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return modulesHandler(req, res);
}
