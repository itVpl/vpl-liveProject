import axios from 'axios';

/**
 * Get latitude and longitude from address using OpenStreetMap Nominatim API
 * @param {string} address - Full address string
 * @returns {Promise<{lat: number, lon: number} | null>} - Returns lat/lon or null if not found
 */
export async function getLatLngFromAddress(address) {
  try {
    const url = `https://nominatim.openstreetmap.org/search`;
    const params = {
      q: address,
      format: 'json',
      limit: 1,
    };
    const response = await axios.get(url, { params, headers: { 'User-Agent': 'vpl-liveProject/1.0' } });
    if (response.data && response.data.length > 0) {
      const { lat, lon } = response.data[0];
      return { lat: parseFloat(lat), lon: parseFloat(lon) };
    }
    return null;
  } catch (err) {
    console.error('Geocoding error:', err.message);
    return null;
  }
} 