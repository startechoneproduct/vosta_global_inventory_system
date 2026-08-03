const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'StaceyPOS/1.0 (internal business app - driver tracking)';

// Coordinates -> human-readable address
async function reverseGeocode(latitude, longitude) {
  try {
    const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    const data = await response.json();

    if (data && data.display_name) {
      return data.display_name;
    }
    // Fallback if the service has no address for this exact point - still
    // avoids showing raw decimal coordinates as the primary display value.
    return 'Unknown location (address lookup failed)';
  } catch (error) {
    console.error('Reverse geocoding failed:', error.message);
    return 'Unknown location (address lookup failed)';
  }
}

// Address text -> coordinates + a cleaned-up formatted address
async function forwardGeocode(addressText) {
  try {
    const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(addressText)}&limit=1`;
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    const data = await response.json();

    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        formattedAddress: data[0].display_name,
      };
    }
    return null;
  } catch (error) {
    console.error('Forward geocoding failed:', error.message);
    return null;
  }
}

module.exports = { reverseGeocode, forwardGeocode };