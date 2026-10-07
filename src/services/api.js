const BASE_URL = '/api'; // Uses Vite proxy to avoid CORS
// Helper to format JSON response
async function fetchJson(endpoint) {
    const url = `./api${endpoint}&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('API request failed');
    return res.json();
}

export async function fetchLocation(query) {
    return fetchJson(`/location?input=${encodeURIComponent(query)}`);
}

export async function fetchJourney(fromLoc, toLoc, dateStr, timeStr, options = {}) {
    const originParams = fromLoc.id 
        ? `originId=${fromLoc.id}` 
        : `originCoordX=${fromLoc.x}&originCoordY=${fromLoc.y}&originCoordName=${encodeURIComponent(fromLoc.name)}`;
        
    const destParams = toLoc.id 
        ? `destId=${toLoc.id}` 
        : `destCoordX=${toLoc.x}&destCoordY=${toLoc.y}&destCoordName=${encodeURIComponent(toLoc.name)}`;
        
    let url = `/trip?${originParams}&${destParams}`;
    
    if (dateStr) {
        // HTML input date is YYYY-MM-DD. Rejseplanen wants DD.MM.YY
        const [yyyy, mm, dd] = dateStr.split('-');
        url += `&date=${dd}.${mm}.${yyyy.slice(2)}`;
    }
    if (timeStr) {
        url += `&time=${timeStr}`;
    }
    if (options.useMetro !== undefined) {
        url += `&useMetro=${options.useMetro ? 1 : 0}`;
    }
    if (options.useBus !== undefined) {
        url += `&useBus=${options.useBus ? 1 : 0}`;
    }
    if (options.useTrain !== undefined) {
        url += `&useTrain=${options.useTrain ? 1 : 0}`;
    }
    
    return fetchJson(url);
}

export async function fetchDepartures(stationId, timeStr, dateStr) {
    let url = `/departureBoard?id=${stationId}`;
    if (timeStr) {
        url += `&time=${timeStr}`;
    }
    if (dateStr) {
        const [yyyy, mm, dd] = dateStr.split('-');
        url += `&date=${dd}.${mm}.${yyyy.slice(2)}`;
    }
    return fetchJson(url);
}

export async function fetchStopsNearby(coordX, coordY) {
    return fetchJson(`/stopsNearby?coordX=${coordX}&coordY=${coordY}`);
}

