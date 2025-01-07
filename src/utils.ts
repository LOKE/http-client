import urlTemplate from "url-template";

export function memoize<K, V>(fn: (_key: K) => V): (_key: K) => V {
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
	expand(_parameters: unknown): string;
}

type Parse = (_pathTemplate: string) => Expander;

export const parseUrlTemplate: Parse = memoize((pathTemplate: string) => 
	urlTemplate.parseTemplate(pathTemplate),
);
