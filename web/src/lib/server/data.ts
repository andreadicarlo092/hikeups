import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Trail, TrailMeta } from '$lib/types';

const DATA_DIR = process.env.TRAIL_DATA_DIR || path.resolve('static/data');

export async function readTrailIndex(): Promise<{ id: number; name: string }[]> {
	try {
		return JSON.parse(await readFile(path.join(DATA_DIR, 'trails_index.json'), 'utf-8'));
	} catch {
		return [];
	}
}

export async function readTrailMeta(id: number): Promise<TrailMeta | null> {
	try {
		const trail: Trail = JSON.parse(await readFile(path.join(DATA_DIR, 'trails', `${id}.json`), 'utf-8'));
		const { geometry: _g, elevation_profile: _p, ...meta } = trail;
		return meta;
	} catch {
		return null;
	}
}
