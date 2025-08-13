import moment from 'moment';

// Get current date in YYYY-MM-DD format
export const getCurrentDate = () => {
  return moment().format('YYYY-MM-DD');
};

// Get start of current day in YYYY-MM-DD HH:mm:ss format
export const getStartOfDay = () => {
  return moment().startOf('day').format('YYYY-MM-DD HH:mm:ss');
};

// Get end of current day in YYYY-MM-DD HH:mm:ss format
export const getEndOfDay = () => {
  return moment().endOf('day').format('YYYY-MM-DD HH:mm:ss');
};

// Get start of specific date
export const getStartOfDate = (date) => {
  return moment(date).startOf('day').format('YYYY-MM-DD HH:mm:ss');
};

// Get end of specific date
export const getEndOfDate = (date) => {
  return moment(date).endOf('day').format('YYYY-MM-DD HH:mm:ss');
};

// Get yesterday's start and end
export const getYesterdayRange = () => {
  const yesterday = moment().subtract(1, 'day');
  return {
    startTime: yesterday.startOf('day').format('YYYY-MM-DD HH:mm:ss'),
    endTime: yesterday.endOf('day').format('YYYY-MM-DD HH:mm:ss')
  };
};

// Get last 7 days range
export const getLastWeekRange = () => {
  return {
    startTime: moment().subtract(7, 'days').startOf('day').format('YYYY-MM-DD HH:mm:ss'),
    endTime: moment().endOf('day').format('YYYY-MM-DD HH:mm:ss')
  };
};

// Get current month range
export const getCurrentMonthRange = () => {
  return {
    startTime: moment().startOf('month').format('YYYY-MM-DD HH:mm:ss'),
    endTime: moment().endOf('month').format('YYYY-MM-DD HH:mm:ss')
  };
};

// Get custom date range
export const getCustomDateRange = (fromDate, toDate) => {
  return {
    startTime: moment(fromDate).startOf('day').format('YYYY-MM-DD HH:mm:ss'),
    endTime: moment(toDate).endOf('day').format('YYYY-MM-DD HH:mm:ss')
  };
};

// Format date for 8x8 API
export const formatDateFor8x8 = (date) => {
  return moment(date).format('YYYY-MM-DD HH:mm:ss');
};

// Utility functions for IST (Indian Standard Time) date handling

/**
 * Get current date and time in IST
 * @returns {Date} Current date in IST
 */
export function getCurrentDateIST() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    return new Date(now.getTime() + istOffset);
}

/**
 * Convert a date to IST
 * @param {Date} date - Date to convert
 * @returns {Date} Date in IST
 */
export function convertToIST(date) {
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    return new Date(date.getTime() + istOffset);
}

/**
 * Format date to IST string
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string in IST
 */
export function formatDateIST(date) {
    const istDate = convertToIST(date);
    return istDate.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format date and time to IST string
 * @param {Date} date - Date to format
 * @returns {string} Formatted date and time string in IST
 */
export function formatDateTimeIST(date) {
    const istDate = convertToIST(date);
    return istDate.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * Add days to current IST date
 * @param {number} days - Number of days to add
 * @returns {Date} Date in IST
 */
export function addDaysToIST(days) {
    const currentIST = getCurrentDateIST();
    currentIST.setDate(currentIST.getDate() + days);
    return currentIST;
}

/**
 * Check if a date has expired (comparing with current IST time)
 * @param {Date} expiryDate - Date to check
 * @returns {boolean} True if expired
 */
export function isExpiredIST(expiryDate) {
    const currentIST = getCurrentDateIST();
    return currentIST > convertToIST(expiryDate);
} 