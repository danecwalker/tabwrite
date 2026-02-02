export function debounce<T extends (...args: unknown[]) => unknown>(
	fn: T,
	delay: number
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return (...args: Parameters<T>) => {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
		timeoutId = setTimeout(() => {
			fn(...args);
		}, delay);
	};
}

export interface CitationDetectorCallbacks {
	onStart: () => void;
	onComplete: (claims: CitationClaimResult[]) => void;
	onError?: (error: Error) => void;
}

export interface CitationClaimResult {
	claim: string;
	searchQuery: string;
	startIndex: number;
	endIndex: number;
}

export function createCitationDetector(delay: number = 2000) {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let abortController: AbortController | null = null;
	let lastSentText: string = '';

	return {
		detect: (text: string, callbacks: CitationDetectorCallbacks) => {
			// Cancel any pending request/timeout
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
			if (abortController) {
				abortController.abort();
				abortController = null;
			}

			// Skip if text hasn't changed enough (at least 10 chars difference or new text)
			if (text === lastSentText) {
				return;
			}

			// Skip if text is too short
			if (text.length < 20) {
				return;
			}

			timeoutId = setTimeout(async () => {
				abortController = new AbortController();
				callbacks.onStart();

				try {
					const response = await fetch('/api/citations', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ text }),
						signal: abortController.signal
					});

					if (response.ok) {
						const data = await response.json();
						lastSentText = text;
						if (data.claims && Array.isArray(data.claims)) {
							callbacks.onComplete(data.claims);
						} else {
							callbacks.onComplete([]);
						}
					} else {
						callbacks.onComplete([]);
					}
				} catch (e) {
					if (e instanceof Error && e.name !== 'AbortError') {
						console.error('Citation detection error:', e);
						callbacks.onError?.(e);
					}
					// On abort, don't call onComplete - a new detection will handle it
				}
			}, delay);
		},
		cancel: () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
			if (abortController) {
				abortController.abort();
				abortController = null;
			}
		},
		reset: () => {
			lastSentText = '';
		}
	};
}

export function createDebouncedFetcher(delay: number = 500) {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let abortController: AbortController | null = null;

	return {
		fetch: (prefix: string, suffix: string, onComplete: (completion: string) => void) => {
			// Cancel any pending request
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			if (abortController) {
				abortController.abort();
			}

			timeoutId = setTimeout(async () => {
				abortController = new AbortController();

				try {
					const response = await fetch('/api/complete', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ prefix, suffix }),
						signal: abortController.signal
					});

					if (response.ok) {
						const data = await response.json();
						if (data.completion) {
							onComplete(data.completion);
						}
					}
				} catch (e) {
					if (e instanceof Error && e.name !== 'AbortError') {
						console.error('Fetch error:', e);
					}
				}
			}, delay);
		},
		cancel: () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
			if (abortController) {
				abortController.abort();
				abortController = null;
			}
		}
	};
}
