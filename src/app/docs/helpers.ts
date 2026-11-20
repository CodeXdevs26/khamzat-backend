import { z, ZodType } from "zod";

export type Obj = { [key: string]: unknown };

// Request body schemas are generated from the same Zod schemas the API
// validates with, so the docs cannot drift from the real payloads.
export const schemaOf = (schema: ZodType): Obj => {
  const json = z.toJSONSchema(schema, {
    io: "input",
    unrepresentable: "any",
    target: "openapi-3.0",
  }) as Obj;
  delete json.$schema;
  return json;
};

export const ref = (name: string): Obj => ({
  $ref: `#/components/schemas/${name}`,
});

export const bearer = [{ bearerAuth: [] }];

export const jsonBody = (
  schema: ZodType | Obj,
  example?: unknown,
  description?: string
): Obj => ({
  required: true,
  ...(description ? { description } : {}),
  content: {
    "application/json": {
      schema: schema instanceof z.ZodType ? schemaOf(schema) : schema,
      ...(example === undefined ? {} : { example }),
    },
  },
});

// Multipart endpoints send the JSON fields as a string in `payload` and the
// files as separate parts (see `validate(schema, { formData: true })`).
export const multipartBody = (options: {
  payload?: ZodType;
  payloadExample?: unknown;
  payloadRequired?: boolean;
  files: {
    name: string;
    description: string;
    required?: boolean;
    multiple?: boolean;
  }[];
}): Obj => {
  const properties: Obj = {};
  if (options.payload) {
    properties.payload = {
      type: "string",
      description:
        "JSON string. Shape: " +
        JSON.stringify(schemaOf(options.payload).properties),
      ...(options.payloadExample === undefined
        ? {}
        : { example: JSON.stringify(options.payloadExample) }),
    };
  }
  for (const file of options.files) {
    const binary = { type: "string", format: "binary" };
    properties[file.name] = {
      ...(file.multiple ? { type: "array", items: binary } : binary),
      description: file.description,
    };
  }

  const required = [
    ...(options.payload && options.payloadRequired !== false
      ? ["payload"]
      : []),
    ...options.files.filter(f => f.required).map(f => f.name),
  ];

  return {
    required: true,
    content: {
      "multipart/form-data": {
        schema: {
          type: "object",
          properties,
          ...(required.length ? { required } : {}),
        },
      },
    },
  };
};

const envelope = (dataSchema?: Obj): Obj => ({
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    message: { type: "string" },
    data: dataSchema ?? { nullable: true, example: null },
  },
});

export const ok = (
  description: string,
  dataSchema?: Obj,
  status: "200" | "201" = "200"
): Obj => ({
  [status]: {
    description,
    content: { "application/json": { schema: envelope(dataSchema) } },
  },
});

const errorResponse = (description: string): Obj => ({
  description,
  content: { "application/json": { schema: ref("Error") } },
});

export const errors = (...codes: ("400" | "401" | "403" | "404")[]): Obj => {
  const all: Record<string, string> = {
    "400": "Bad request / business rule violated",
    "401": "Missing or invalid access token",
    "403": "Role not allowed",
    "404": "Not found",
  };
  return Object.fromEntries(codes.map(c => [c, errorResponse(all[c]!)]));
};

export const pathParam = (name: string, description: string): Obj => ({
  name,
  in: "path",
  required: true,
  description,
  schema: { type: "string" },
});

export const queryParam = (
  name: string,
  description: string,
  schema: Obj = { type: "string" }
): Obj => ({ name, in: "query", required: false, description, schema });

export const paginationParams = (defaultLimit: number): Obj[] => [
  queryParam("page", "Page number (starts at 1)", {
    type: "integer",
    default: 1,
  }),
  queryParam("limit", "Items per page", {
    type: "integer",
    default: defaultLimit,
  }),
  queryParam("sortBy", "Field to sort by (use together with orderBy)"),
  queryParam("orderBy", "Sort direction (use together with sortBy)", {
    type: "string",
    enum: ["asc", "desc"],
  }),
];

export const arrayOf = (schema: Obj): Obj => ({ type: "array", items: schema });
