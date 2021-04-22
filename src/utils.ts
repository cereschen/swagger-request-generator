import { swaggerRequest } from "./type";

export function getBody(method: swaggerRequest, type: string, version: string) {


  let bodyType: RegExpMatchArray | null = null //  body的实体类
  let bodySchema
  let hasParameters = false
  if (version === "v3") {
    let json = method.requestBody?.content?.['application/json']

    if (json) {
      bodySchema = json?.schema?.items || json?.schema
      if (bodySchema && bodySchema.$ref) {
        bodyType = bodySchema.$ref.match(/components[/]schemas[/](.*)/)
      }
    }
    hasParameters = Boolean(method.parameters || method.requestBody)
  }
  if (version === "v2") {
    if (type.trim() !== 'get') {
      let params0 = method.parameters?.find(item => item.in === "body")
      console.log(type);
      if (params0?.schema?.$ref) {
        bodyType = params0.schema.$ref.match(/definitions[/](.*)/)
      }
    }

    hasParameters = Boolean(method.parameters)
  }

  return { bodyType, bodySchema, hasParameters }
}

