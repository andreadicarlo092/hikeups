export type Difficulty = 'T' | 'E' | 'EE' | 'EEA';

export interface TrailSummary {
	id: number;
	name: string;
	cai_ref: string | null;
	difficulty: Difficulty | null;
	length_km: number;
	elevation_gain_m: number;
	elevation_loss_m: number;
	duration_hours: number;
	tags: string[];
}

export interface Trailhead {
	id: number;
	name: string;
	lng: number;
	lat: number;
	trail_count: number;
	trails: TrailSummary[];
}

export interface LngLat {
	lng: number;
	lat: number;
}

export interface ProfilePoint {
	d_km: number;
	alt_m: number;
}

export interface Trail extends TrailSummary {
	osm_id: number;
	osm_url: string;
	difficulty_source: 'cai_scale' | 'via_ferrata_scale' | 'sac_scale' | 'way_sac_scale' | 'missing';
	network: string | null;
	description: string | null;
	from: string | null;
	to: string | null;
	operator: string | null;
	start: LngLat;
	end: LngLat;
	geometry: { type: 'LineString'; coordinates: [number, number][] };
	elevation_profile: ProfilePoint[];
	gpx_url: string;
	trailheads: { id: number; name: string }[];
}

export type TrailMeta = Omit<Trail, 'geometry' | 'elevation_profile'>;
