import app from '../src/server.js';
import { handle } from 'hono/vercel';

export default handle(app);
