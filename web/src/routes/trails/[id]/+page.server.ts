import { error } from '@sveltejs/kit';
import { readTrailIndex, readTrailMeta } from '$lib/server/data';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = async () =>
	(await readTrailIndex()).map((t) => ({ id: String(t.id) }));

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) error(404, 'Sentiero non trovato');
	const trail = await readTrailMeta(id);
	if (!trail) error(404, 'Sentiero non trovato');
	return { trail };
};
