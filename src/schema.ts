/**
 * TypeBox → JSON Schema Converter
 *
 * memory-lancedb-pro uses @sinclair/typebox to define tool parameters.
 * MCP protocol expects standard JSON Schema in tools/list responses.
 *
 * TypeBox schemas are actually valid JSON Schema objects internally,
 * so conversion is mostly about cleaning up TypeBox-specific extensions
 * and ensuring MCP-compatible format.
 */

// ============================================================================
// Types
// ============================================================================

export interface JsonSchema {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  additionalProperties?: boolean | JsonSchema;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  [key: string]: unknown;
}

// ============================================================================
// Converter
// ============================================================================

/**
 * Convert a TypeBox schema to clean JSON Schema for MCP.
 *
 * TypeBox schemas are already JSON Schema compatible but may contain
 * internal symbols and TypeBox-specific properties that should be stripped.
 */
export function typeboxToJsonSchema(typeboxSchema: unknown): JsonSchema {
  if (!typeboxSchema || typeof typeboxSchema !== "object") {
    return { type: "object", properties: {} };
  }

  const schema = typeboxSchema as Record<string, unknown>;
  return cleanSchema(schema);
}

/**
 * Recursively clean a schema object, removing TypeBox internals.
 */
function cleanSchema(schema: Record<string, unknown>): JsonSchema {
  const result: JsonSchema = {};

  // Copy standard JSON Schema properties
  const standardProps = [
    "type", "description", "default", "enum",
    "minimum", "maximum", "minLength", "maxLength",
    "minItems", "maxItems", "pattern",
    "additionalProperties", "required",
    "oneOf", "anyOf", "allOf", "not",
    "const", "format",
  ];

  for (const prop of standardProps) {
    if (schema[prop] !== undefined) {
      result[prop] = schema[prop];
    }
  }

  // Handle 'properties' (for object types)
  if (schema.properties && typeof schema.properties === "object") {
    const props: Record<string, JsonSchema> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(schema.properties as Record<string, unknown>)) {
      if (value && typeof value === "object") {
        const propSchema = value as Record<string, unknown>;
        props[key] = cleanSchema(propSchema);

        // TypeBox uses [Kind]: 'Optional' for optional props
        // If not optional, add to required
        const kind = (propSchema as Record<string | symbol, unknown>)[Symbol.for("TypeBox.Kind")] as string | undefined;
        const kindStr = propSchema["kind"] as string | undefined;

        // Check if this property is wrapped in Optional
        if (kind !== "Optional" && kindStr !== "Optional") {
          // Also check the TypeBox modifier
          const modifier = (propSchema as Record<string | symbol, unknown>)[Symbol.for("TypeBox.Modifier")] as string | undefined;
          if (modifier !== "Optional") {
            required.push(key);
          }
        }
      }
    }

    result.properties = props;

    // Use existing required array if present, otherwise computed
    if (Array.isArray(schema.required)) {
      result.required = schema.required as string[];
    } else if (required.length > 0) {
      result.required = required;
    }
  }

  // Handle 'items' (for array types)
  if (schema.items && typeof schema.items === "object") {
    result.items = cleanSchema(schema.items as Record<string, unknown>);
  }

  // Handle oneOf/anyOf/allOf with recursive cleaning
  for (const combiner of ["oneOf", "anyOf", "allOf"] as const) {
    if (Array.isArray(schema[combiner])) {
      result[combiner] = (schema[combiner] as Record<string, unknown>[]).map(cleanSchema);
    }
  }

  // If type is missing but has properties, infer 'object'
  if (!result.type && result.properties) {
    result.type = "object";
  }

  return result;
}

/**
 * Extract tool input schema for MCP tools/list response.
 * Ensures the top-level is always a valid JSON Schema object type.
 */
export function extractInputSchema(parameters: unknown): JsonSchema {
  const schema = typeboxToJsonSchema(parameters);

  // MCP requires top-level to be an object type
  if (schema.type !== "object") {
    return {
      type: "object",
      properties: {
        input: schema,
      },
    };
  }

  return schema;
}
