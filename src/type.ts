export interface swaggerJson {
  components: {
    schemas: swaggerDefinitions
  },
  definitions: swaggerDefinitions
  tags: { name: string, description: string }[]
  paths: {
    [key: string]: swaggerPath
  }
}

export interface swaggerPath {
  [key: string]: swaggerRequest
}

export interface swaggerRequest {
  tags: string[]
  summary: string
  description: string
  operationId: string,
  requestBody: { content: Record<string, any> },
  parameters?: swaggerParameter[]
  responses: {
    '200': {
      schema: {
        $ref: string
        type: string
      }
    }
  }
}

export interface swaggerParameter {
  in: string
  name: string
  description: string
  required: boolean
  type: string
  items: {
    type: string
  }
  schema: {
    $ref: string
    type: string
    items: swaggerRefDefinition
  }
}

export interface swaggerRefDefinition {
  $ref: string
  originalRef: string
}

export interface swaggerDefinitions {
  [key: string]: swaggerDefinition
}

export interface swaggerDefinition {
  type: string
  required: string[]
  properties: {
    [key: string]: swaggerProperty
  }
  title: string
  description?: string
}

export interface swaggerProperty {
  type: string
  description: string
  $ref?: string
  items: swaggerProperty
}
