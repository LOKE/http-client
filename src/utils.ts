type Context = Record<string, unknown>;

type Template = {
  // eslint-disable-next-line no-unused-vars -- This is used
  expand: (context: Context) => string;
};

function encodeReserved(str: string): string {
  return str
    .split(/(%[0-9A-Fa-f]{2})/g)
    .map((part) => {
      if (!/%[0-9A-Fa-f]/.test(part)) {
        return encodeURI(part)
          .replace(/%5B/g, "[")
          .replace(/%5D/g, "]");
      }
      return part;
    })
    .join("");
}

function encodeUnreserved(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodeValue(
  operator: string,
  value: string,
  key?: string
): string {
  const encodedValue =
    operator === "+" || operator === "#"
      ? encodeReserved(value)
      : encodeUnreserved(value);

  return key
    ? `${encodeUnreserved(key)}=${encodedValue}`
    : encodedValue;
}

function isDefined(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function isKeyOperator(operator: string): boolean {
  return [";", "&", "?"].includes(operator);
}

function getValues(
  context: Context,
  operator: string,
  key: string,
  modifier?: string
): string[] {
  const value = context[key];
  const result: string[] = [];

  if (isDefined(value) && value !== "") {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      let stringValue = value.toString();

      if (modifier && modifier !== "*") {
        stringValue = stringValue.substring(
          0,
          parseInt(modifier, 10)
        );
      }

      result.push(
        encodeValue(
          operator,
          stringValue,
          isKeyOperator(operator) ? key : undefined
        )
      );
    } else if (modifier === "*") {
      if (Array.isArray(value)) {
        value.filter(isDefined).forEach((item) => {
          result.push(
            encodeValue(
              operator,
              item.toString(),
              isKeyOperator(operator) ? key : undefined
            )
          );
        });
      } else {
        Object.entries(value as Record<string, unknown>).forEach(
          ([subKey, subValue]) => {
            if (isDefined(subValue)) {
              result.push(
                encodeValue(operator, String(subValue), subKey)
              );
            }
          }
        );
      }
    } else {
      const tmp: string[] = [];

      if (Array.isArray(value)) {
        value.filter(isDefined).forEach((item) => {
          tmp.push(encodeValue(operator, item.toString()));
        });
      } else {
        Object.entries(value as Record<string, unknown>).forEach(
          ([subKey, subValue]) => {
            if (isDefined(subValue)) {
              tmp.push(encodeUnreserved(subKey));
              tmp.push(encodeValue(operator, String(subValue)));
            }
          }
        );
      }

      if (isKeyOperator(operator)) {
        result.push(`${encodeUnreserved(key)}=${tmp.join(",")}`);
      } else if (tmp.length > 0) {
        result.push(tmp.join(","));
      }
    }
  } else {
    if (operator === ";" && isDefined(value)) {
      result.push(encodeUnreserved(key));
    } else if (value === "" && ["&", "?"].includes(operator)) {
      result.push(`${encodeUnreserved(key)}=`);
    } else if (value === "") {
      result.push("");
    }
  }

  return result;
}

function parseTemplate(template: string): Template {
  const operators = ["+", "#", ".", "/", ";", "?", "&"];

  return {
    expand: (context: Context): string => {
      return template.replace(
        /\{([^{}]+)\}|([^{}]+)/g,
        (_, expression, literal) => {
          if (expression) {
            let operator: string | null = null;
            const values: string[] = [];

            if (operators.includes(expression.charAt(0))) {
              operator = expression.charAt(0);
              // eslint-disable-next-line no-param-reassign
              expression = expression.substring(1);
            }

            expression.split(",").forEach((variable: string) => {
              const match = /([^:*]*)(?::(\d+)|\*)?/.exec(variable);
              if (match) {
                values.push(
                  ...getValues(
                    context,
                    operator || "",
                    match[1],
                    match[2]
                  )
                );
              }
            });

            const separator =
              operator === ";" || operator === "&" || operator === "?"
                ? operator
                : operator === "#"
                ? "#"
                : ",";

            return (
              (values.length > 0 ? operator || "" : "") +
              values.join(separator)
            );
          }
          return encodeReserved(literal);
        }
      );
    },
  };
}

function memoize<K, V>(fn: (_key: K) => V): (_key: K) => V {
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
  // eslint-disable-next-line no-unused-vars -- This is actually used
  expand(parameters: unknown): string;
}

// eslint-disable-next-line no-unused-vars -- This is actually used
type Parse = (pathTemplate: string) => Expander;

export const parseUrlTemplate: Parse = memoize(
  (pathTemplate: string) => parseTemplate(pathTemplate)
);
