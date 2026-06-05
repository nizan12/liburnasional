import app from '../index.js';
import { handle } from 'hono/vercel';

export default handle(app);
