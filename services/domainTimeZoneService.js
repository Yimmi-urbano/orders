const DEFAULT_TIME_ZONE = 'America/Lima';

function isValidTimeZone(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(); return true; }
    catch { return false; }
}

async function getDomainTimeZone(domain) {
    const defaultUrl = process.env.NODE_ENV === 'production'
        ? 'https://api-configuration.creceidea.pe/api'
        : 'http://127.0.0.1:7000/api';
    const baseUrl = (process.env.CONFIGURATION_API_URL || defaultUrl).replace(/\/$/, '');
    try {
        const response = await fetch(`${baseUrl}/configurations/time-zone`, { headers: { domain } });
        const body = await response.json();
        const timeZone = response.ok && body?.status === true && isValidTimeZone(body.data?.timeZone)
            ? body.data.timeZone
            : DEFAULT_TIME_ZONE;
        return timeZone;
    } catch {
        return DEFAULT_TIME_ZONE;
    }
}

module.exports = { DEFAULT_TIME_ZONE, getDomainTimeZone, isValidTimeZone };
