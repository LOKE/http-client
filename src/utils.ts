import urlTemplate from "url-template";

export function memoize<K, V>(fn: (key: K) => V): (key: K) => V {
	const cache = new Map<K, V>();

	return (key: K) => {
		if (cache.has(key)) {
			return cache.get(key) as V;
		}

		const val = fn(key);
		cache.set(key, val);

		return val;
	};
}

interface Expander {
	expand(parameters: any): string;
}

type Parse = (pathTemplate: string) => Expander;

export const parseUrlTemplate: Parse = memoize((pathTemplate: string) =>
	urlTemplate.parse(pathTemplate),
);
