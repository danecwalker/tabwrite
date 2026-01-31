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

export function createDebouncedFetcher(delay: number = 500) {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let abortController: AbortController | null = null;

	return {
		fetch: (context: string, onComplete: (completion: string) => void) => {
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
						body: JSON.stringify({ context }),
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
