import * as cheerio from 'cheerio';

const MONTH_MAP = {
  'januari': '01',
  'februari': '02',
  'maret': '03',
  'april': '04',
  'mei': '05',
  'juni': '06',
  'juli': '07',
  'agustus': '08',
  'september': '09',
  'oktober': '10',
  'november': '11',
  'desember': '12'
};

/**
 * Fetches HTML from tanggalans.com for the specified year.
 * If the request fails, it throws an error.
 * @param {string} year 
 * @returns {Promise<string>} HTML content
 */
const fetchHTML = async (year) => {
  const url = `https://tanggalans.com/kalender-${year}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    signal: AbortSignal.timeout(3000) // 3 seconds timeout
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch calendar for year ${year} (Status: ${response.status})`);
  }

  return await response.text();
};

/**
 * Crawls tanggalans.com and extracts holidays for a given year.
 * @param {string} year 
 * @returns {Promise<Array<{date: string, name: string}>>} List of holidays
 */
export const crawlHolidays = async (year) => {
  const html = await fetchHTML(year);
  const $ = cheerio.load(html);

  const months = $('.entry-content .kalender-indo');
  const holidays = [];

  months.each((_, item) => {
    const $item = $(item);
    const titleText = $item.find('.kal-title .kal-title-link').text().trim();
    if (!titleText) return;

    const [monthName, yearVal] = titleText.split(' ');
    if (!monthName || !yearVal) return;

    const monthNum = MONTH_MAP[monthName.toLowerCase()];
    if (!monthNum) return;

    $item.find('.kal-libur-list li').each((_, holidayItem) => {
      const $holiday = $(holidayItem);
      const dayEl = $holiday.find('.kal-libur-day');
      const dayText = dayEl.text().trim();
      
      const fullText = $holiday.text().trim();
      const holidayName = fullText.slice(dayText.length).trim();

      if (!dayText || !holidayName) return;

      // Handle day ranges, e.g. "24-25"
      if (dayText.includes('-')) {
        const parts = dayText.split('-');
        const start = parseInt(parts[0], 10);
        const end = parseInt(parts[1], 10);

        if (!isNaN(start) && !isNaN(end)) {
          for (let d = start; d <= end; d++) {
            const formattedDay = d.toString().padStart(2, '0');
            holidays.push({
              date: `${yearVal}-${monthNum}-${formattedDay}`,
              name: holidayName,
              is_national_holiday: !holidayName.toLowerCase().includes('cuti bersama')
            });
          }
        }
      } else {
        const formattedDay = dayText.padStart(2, '0');
        holidays.push({
          date: `${yearVal}-${monthNum}-${formattedDay}`,
          name: holidayName,
          is_national_holiday: !holidayName.toLowerCase().includes('cuti bersama')
        });
      }
    });
  });

  // Sort chronologically by date
  return holidays.sort((a, b) => a.date.localeCompare(b.date));
};
