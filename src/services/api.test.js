import { describe, it, expect } from 'vitest';
import { fetchLocation, fetchJourney, fetchDepartures, fetchStopsNearby } from './api.js';

describe('api service', () => {
    it('fetchLocation fetches location with encoded query', async () => {
        const mockResponse = { LocationList: { StopLocation: [{ name: 'København H', id: '1' }] } };
        let requestedUrl = null;

        globalThis.fetch = async (url) => {
            requestedUrl = url;
            return {
                ok: true,
                json: async () => mockResponse,
            };
        };

        const result = await fetchLocation('København H');
        expect(requestedUrl).toBe(
            './api/location?input=K%C3%B8benhavn%20H&format=json'
        );
        expect(result).toEqual(mockResponse);
    });

    it('fetchJourney fetches trip with origin and destination IDs', async () => {
        const mockResponse = { TripList: { Trip: [] } };
        let requestedUrl = null;

        globalThis.fetch = async (url) => {
            requestedUrl = url;
            return {
                ok: true,
                json: async () => mockResponse,
            };
        };

        const result = await fetchJourney({ id: '8600626' }, { id: '8600700' });
        expect(requestedUrl).toBe(
            './api/trip?originId=8600626&destId=8600700&format=json'
        );
        expect(result).toEqual(mockResponse);
    });

    it('fetchDepartures fetches departure board for station ID', async () => {
        const mockResponse = { DepartureBoard: { Departure: [] } };
        let requestedUrl = null;

        globalThis.fetch = async (url) => {
            requestedUrl = url;
            return {
                ok: true,
                json: async () => mockResponse,
            };
        };

        const result = await fetchDepartures('8600626');
        expect(requestedUrl).toBe(
            './api/departureBoard?id=8600626&format=json'
        );
        expect(result).toEqual(mockResponse);
    });

    it('fetchStopsNearby fetches nearby stops with coordinates', async () => {
        const mockResponse = { LocationList: { StopLocation: [{ name: 'Elmegade', id: '45740' }] } };
        let requestedUrl = null;

        globalThis.fetch = async (url) => {
            requestedUrl = url;
            return {
                ok: true,
                json: async () => mockResponse,
            };
        };

        const result = await fetchStopsNearby('12560160', '55688075');
        expect(requestedUrl).toBe(
            './api/stopsNearby?coordX=12560160&coordY=55688075&format=json'
        );
        expect(result).toEqual(mockResponse);
    });

    it('throws error when API request fails (res.ok is false)', async () => {
        globalThis.fetch = async () => ({
            ok: false,
            status: 500,
        });

        await expect(fetchLocation('test')).rejects.toThrow('API request failed');
    });
});
