/**
 * Indian Calendar Service
 * Provides information about Indian festivals, holidays, and special days
 */

// Major Indian Festivals and National Holidays (with approximate dates)
// Note: Many Indian festivals follow lunar calendar, so dates vary yearly
const indianHolidays2025 = [
  // January
  { date: '2025-01-01', name: 'New Year', type: 'public' },
  { date: '2025-01-14', name: 'Makar Sankranti', type: 'festival' },
  { date: '2025-01-26', name: 'Republic Day', type: 'national' },
  
  // February
  { date: '2025-02-12', name: 'Maha Shivaratri', type: 'festival' },
  { date: '2025-02-26', name: 'Guru Ravidas Jayanti', type: 'festival' },
  
  // March
  { date: '2025-03-14', name: 'Holi', type: 'festival' },
  { date: '2025-03-29', name: 'Good Friday', type: 'public' },
  { date: '2025-03-30', name: 'Ram Navami', type: 'festival' },
  { date: '2025-03-31', name: 'Easter Sunday', type: 'public' },
  
  // April
  { date: '2025-04-10', name: 'Mahavir Jayanti', type: 'festival' },
  { date: '2025-04-13', name: 'Baisakhi', type: 'festival' },
  { date: '2025-04-14', name: 'Ambedkar Jayanti', type: 'national' },
  { date: '2025-04-18', name: 'Hanuman Jayanti', type: 'festival' },
  
  // May
  { date: '2025-05-01', name: 'May Day', type: 'public' },
  { date: '2025-05-12', name: 'Buddha Purnima', type: 'festival' },
  
  // June
  { date: '2025-06-06', name: 'Eid ul-Adha (Bakrid)', type: 'festival' },
  
  // July
  { date: '2025-07-05', name: 'Rath Yatra', type: 'festival' },
  
  // August
  { date: '2025-08-15', name: 'Independence Day', type: 'national' },
  { date: '2025-08-16', name: 'Parsi New Year', type: 'festival' },
  { date: '2025-08-20', name: 'Raksha Bandhan', type: 'festival' },
  { date: '2025-08-27', name: 'Janmashtami', type: 'festival' },
  
  // September
  { date: '2025-09-05', name: 'Ganesh Chaturthi', type: 'festival' },
  
  // October
  { date: '2025-10-02', name: 'Gandhi Jayanti', type: 'national' },
  { date: '2025-10-02', name: 'Dussehra', type: 'festival' },
  { date: '2025-10-20', name: 'Diwali', type: 'festival' },
  { date: '2025-10-21', name: 'Govardhan Puja', type: 'festival' },
  { date: '2025-10-22', name: 'Bhai Dooj', type: 'festival' },
  
  // November
  { date: '2025-11-05', name: 'Guru Nanak Jayanti', type: 'festival' },
  
  // December
  { date: '2025-12-25', name: 'Christmas', type: 'public' }
];

const indianHolidays2024 = [
  // January
  { date: '2024-01-01', name: 'New Year', type: 'public' },
  { date: '2024-01-14', name: 'Makar Sankranti', type: 'festival' },
  { date: '2024-01-26', name: 'Republic Day', type: 'national' },
  
  // February
  { date: '2024-02-08', name: 'Maha Shivaratri', type: 'festival' },
  
  // March
  { date: '2024-03-08', name: 'Holi', type: 'festival' },
  { date: '2024-03-25', name: 'Holi (Regional)', type: 'festival' },
  { date: '2024-03-29', name: 'Good Friday', type: 'public' },
  
  // April
  { date: '2024-04-11', name: 'Eid ul-Fitr', type: 'festival' },
  { date: '2024-04-14', name: 'Ambedkar Jayanti', type: 'national' },
  { date: '2024-04-17', name: 'Ram Navami', type: 'festival' },
  { date: '2024-04-21', name: 'Mahavir Jayanti', type: 'festival' },
  { date: '2024-04-23', name: 'Hanuman Jayanti', type: 'festival' },
  
  // May
  { date: '2024-05-01', name: 'May Day', type: 'public' },
  { date: '2024-05-23', name: 'Buddha Purnima', type: 'festival' },
  
  // June
  { date: '2024-06-17', name: 'Eid ul-Adha (Bakrid)', type: 'festival' },
  
  // July
  { date: '2024-07-07', name: 'Rath Yatra', type: 'festival' },
  { date: '2024-07-17', name: 'Muharram', type: 'festival' },
  
  // August
  { date: '2024-08-15', name: 'Independence Day', type: 'national' },
  { date: '2024-08-16', name: 'Parsi New Year', type: 'festival' },
  { date: '2024-08-19', name: 'Raksha Bandhan', type: 'festival' },
  { date: '2024-08-26', name: 'Janmashtami', type: 'festival' },
  
  // September
  { date: '2024-09-07', name: 'Ganesh Chaturthi', type: 'festival' },
  { date: '2024-09-16', name: 'Milad un-Nabi', type: 'festival' },
  
  // October
  { date: '2024-10-02', name: 'Gandhi Jayanti', type: 'national' },
  { date: '2024-10-12', name: 'Dussehra', type: 'festival' },
  { date: '2024-10-31', name: 'Diwali', type: 'festival' },
  
  // November
  { date: '2024-11-01', name: 'Govardhan Puja', type: 'festival' },
  { date: '2024-11-02', name: 'Bhai Dooj', type: 'festival' },
  { date: '2024-11-15', name: 'Guru Nanak Jayanti', type: 'festival' },
  
  // December
  { date: '2024-12-25', name: 'Christmas', type: 'public' }
];

// Combine all years
const allHolidays = [...indianHolidays2024, ...indianHolidays2025];

// Create a map for quick lookup
const holidayMap = new Map();
allHolidays.forEach(holiday => {
  holidayMap.set(holiday.date, holiday);
});

/**
 * Check if a date is a Sunday
 * @param {Date|string} date 
 * @returns {boolean}
 */
export const isSunday = (date) => {
  const d = new Date(date);
  return d.getDay() === 0;
};

/**
 * Check if a date is a Saturday
 * @param {Date|string} date 
 * @returns {boolean}
 */
export const isSaturday = (date) => {
  const d = new Date(date);
  return d.getDay() === 6;
};

/**
 * Check if a date is a weekend (Saturday or Sunday)
 * @param {Date|string} date 
 * @returns {boolean}
 */
export const isWeekend = (date) => {
  return isSaturday(date) || isSunday(date);
};

/**
 * Get holiday information for a specific date
 * @param {Date|string} date 
 * @returns {Object|null} Holiday info or null if not a holiday
 */
export const getHolidayInfo = (date) => {
  const d = new Date(date);
  const dateStr = d.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  return holidayMap.get(dateStr) || null;
};

/**
 * Check if a date is a holiday (festival or public holiday)
 * @param {Date|string} date 
 * @returns {boolean}
 */
export const isHoliday = (date) => {
  return getHolidayInfo(date) !== null;
};

/**
 * Check if a date is a national holiday
 * @param {Date|string} date 
 * @returns {boolean}
 */
export const isNationalHoliday = (date) => {
  const holiday = getHolidayInfo(date);
  return holiday !== null && holiday.type === 'national';
};

/**
 * Check if a date is a festival
 * @param {Date|string} date 
 * @returns {boolean}
 */
export const isFestival = (date) => {
  const holiday = getHolidayInfo(date);
  return holiday !== null && holiday.type === 'festival';
};

/**
 * Get all holidays within a date range
 * @param {Date|string} startDate 
 * @param {Date|string} endDate 
 * @returns {Array} Array of holidays
 */
export const getHolidaysInRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  return allHolidays.filter(holiday => {
    const holidayDate = new Date(holiday.date);
    return holidayDate >= start && holidayDate <= end;
  });
};

/**
 * Get day type for a date (weekday, weekend, holiday, festival)
 * @param {Date|string} date 
 * @returns {Object} Day type information
 */
export const getDayType = (date) => {
  const d = new Date(date);
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
  const holiday = getHolidayInfo(date);
  
  return {
    dayName,
    isSunday: isSunday(date),
    isSaturday: isSaturday(date),
    isWeekend: isWeekend(date),
    holiday: holiday,
    isHoliday: holiday !== null,
    isFestival: holiday !== null && holiday.type === 'festival',
    isNationalHoliday: holiday !== null && holiday.type === 'national',
    isPublicHoliday: holiday !== null && holiday.type === 'public'
  };
};

/**
 * Get all unique holidays/festivals from the data
 * @returns {Array} Array of all holidays
 */
export const getAllHolidays = () => {
  return allHolidays;
};

/**
 * Get holiday badge color based on type
 * @param {string} type - holiday type (national, festival, public)
 * @returns {string} Bootstrap color
 */
export const getHolidayBadgeColor = (type) => {
  switch (type) {
    case 'national':
      return 'danger';
    case 'festival':
      return 'warning';
    case 'public':
      return 'info';
    default:
      return 'secondary';
  }
};

export default {
  isSunday,
  isSaturday,
  isWeekend,
  getHolidayInfo,
  isHoliday,
  isNationalHoliday,
  isFestival,
  getHolidaysInRange,
  getDayType,
  getAllHolidays,
  getHolidayBadgeColor
};

