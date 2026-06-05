import { promises as fs } from 'fs';
import path from 'path';
import { crawlHolidays } from './scraper.js';

const CACHE_DIR = path.join(process.cwd(), 'data');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// In-memory cache fallback for read-only environments like Vercel
const memoryCache = new Map();

/**
 * Ensures that the cache directory exists.
 */
const ensureCacheDir = async () => {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
};

/**
 * Returns the cache file path for a specific year.
 * @param {string} year 
 * @returns {string}
 */
const getCacheFilePath = (year) => {
  return path.join(CACHE_DIR, `holidays_${year}.json`);
};

/**
 * Retrieves holiday data, either from cache or by scraping tanggalans.com.
 * @param {string} year 
 * @param {boolean} forceRefresh - If true, bypasses the cache and scrapes fresh data.
 * @returns {Promise<Array<{date: string, name: string, is_national_holiday: boolean}>>}
 */
export const getHolidaysWithCache = async (year, forceRefresh = false) => {
  const currentYear = new Date().getFullYear();
  const isPastYear = parseInt(year, 10) < currentYear;

  // If forceRefresh is false, check memory cache first
  if (!forceRefresh) {
    const memCached = memoryCache.get(year);
    if (memCached && (isPastYear || memCached.expiresAt > Date.now())) {
      return memCached.data;
    }
  }

  await ensureCacheDir().catch(() => {}); // Gracefully ignore directory creation errors on Vercel
  const cacheFile = getCacheFilePath(year);

  let cachedData = null;
  let cacheExpired = true;
  let fileExists = false;

  // Try to read from local file cache
  try {
    const stats = await fs.stat(cacheFile);
    fileExists = true;
    
    const rawData = await fs.readFile(cacheFile, 'utf8');
    cachedData = JSON.parse(rawData);

    if (isPastYear || process.env.VERCEL) {
      cacheExpired = false;
    } else {
      const age = Date.now() - stats.mtimeMs;
      cacheExpired = age > CACHE_DURATION;
    }
  } catch (err) {
    fileExists = false;
  }

  // Use cached file data if valid
  if (fileExists && !cacheExpired && !forceRefresh) {
    // Populate in-memory cache for future requests
    memoryCache.set(year, {
      data: cachedData,
      expiresAt: isPastYear ? Infinity : Date.now() + CACHE_DURATION
    });
    return cachedData;
  }

  // Fetch new data via scraping
  try {
    const freshData = await crawlHolidays(year);
    
    // Save to file cache (will fail on Vercel, which we catch gracefully)
    try {
      await fs.writeFile(cacheFile, JSON.stringify(freshData, null, 2), 'utf8');
    } catch (writeError) {
      console.warn(`Unable to write cache file (Vercel read-only filesystem?): ${writeError.message}`);
    }

    // Always update in-memory cache
    memoryCache.set(year, {
      data: freshData,
      expiresAt: isPastYear ? Infinity : Date.now() + CACHE_DURATION
    });

    return freshData;
  } catch (error) {
    console.error(`Error scraping holidays for year ${year}:`, error.message);
    
    // Fallback to expired file cache if available
    if (fileExists && cachedData) {
      console.warn(`Falling back to expired file cache for year ${year}`);
      return cachedData;
    }

    // Fallback to expired memory cache if available
    const expiredMemCached = memoryCache.get(year);
    if (expiredMemCached) {
      console.warn(`Falling back to expired memory cache for year ${year}`);
      return expiredMemCached.data;
    }
    
    throw error;
  }
};

