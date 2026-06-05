import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { getHolidaysWithCache } from './src/cache.js';

// Setup timezone helper
const getJakartaDateInfo = (date) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year').value;
  const month = parts.find((p) => p.type === 'month').value;
  const day = parts.find((p) => p.type === 'day').value;
  return {
    year,
    month,
    day,
    formatted: `${year}-${month}-${day}`,
  };
};

const getHolidayInfoForDate = async (date, forceRefresh) => {
  const { year, formatted } = getJakartaDateInfo(date);
  
  let holidays = [];
  try {
    holidays = await getHolidaysWithCache(year, forceRefresh);
  } catch (err) {
    console.error(`Failed to get holidays for ${year}:`, err.message);
  }

  const dayHolidays = holidays.filter((h) => h.date === formatted);
  const holidayList = dayHolidays.map((h) => h.name);
  const isHoliday = dayHolidays.length > 0;
  const isNationalHoliday = dayHolidays.some((h) => h.is_national_holiday);

  return {
    date: formatted,
    is_holiday: isHoliday,
    is_national_holiday: isNationalHoliday,
    holiday_list: holidayList,
  };
};

const app = new Hono();

// Middlewares
app.use('*', logger());
app.use('/api/*', cors());

// Query validation schema for /api/holidays
const maxYear = new Date().getFullYear() + 5;
const holidaysQuerySchema = z.object({
  year: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : new Date().getFullYear()))
    .refine((val) => val >= 2011 && val <= maxYear, {
      message: `Year must be between 2011 and ${maxYear}`,
    }),
  month: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine((val) => val === undefined || (val >= 1 && val <= 12), {
      message: 'Month must be between 1 and 12',
    }),
  force: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

// API Routes
app.get(
  '/api/holidays',
  zValidator('query', holidaysQuerySchema),
  async (c) => {
    const { year, month, force } = c.req.valid('query');

    try {
      let holidays = await getHolidaysWithCache(year.toString(), force);

      if (month !== undefined) {
        const monthPadded = month.toString().padStart(2, '0');
        const prefix = `${year}-${monthPadded}`;
        holidays = holidays.filter((h) => h.date.startsWith(prefix));
      }

      return c.json({
        success: true,
        year,
        month: month || null,
        count: holidays.length,
        data: holidays,
      });
    } catch (err) {
      return c.json(
        {
          success: false,
          message: `Gagal mengambil data libur: ${err.message}`,
        },
        500
      );
    }
  }
);

app.get('/api/today', async (c) => {
  const force = c.req.query('force') === 'true';
  try {
    const info = await getHolidayInfoForDate(new Date(), force);
    return c.json({ success: true, ...info });
  } catch (err) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

app.get('/api/tomorrow', async (c) => {
  const force = c.req.query('force') === 'true';
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const info = await getHolidayInfoForDate(tomorrow, force);
    return c.json({ success: true, ...info });
  } catch (err) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

// Static files (frontend)
app.use('/*', serveStatic({ root: './public' }));

// Global error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json(
    {
      success: false,
      message: err.message || 'Internal Server Error',
    },
    500
  );
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
console.log(`Server running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
