export function formatDuration(hours: number): string {
	const total = Math.round(hours * 60);
	const h = Math.floor(total / 60);
	const m = total % 60;
	if (h === 0) return `${m} min`;
	return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}′`;
}

export function formatKm(km: number): string {
	return `${km.toLocaleString('it-IT', { maximumFractionDigits: 1 })} km`;
}

export function formatMeters(m: number): string {
	return `${Math.round(m).toLocaleString('it-IT')} m`;
}
