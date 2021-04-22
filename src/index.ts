import { swaggerJson, swaggerProperty, swaggerParameter, swaggerDefinition, swaggerDefinitions } from './type'
import { getBody } from './utils'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
const { existsSync, mkdirSync, writeFileSync } = fs

export type Options = {
  version: 'v2' | 'v3',
  url?: string,
  outdir: string
}

export async function start(options: Options = { version: 'v2', outdir: 'src' }) {
  let { version, url, outdir } = options
  let modelPath = ''
  let apiPath = ''
  if (path.isAbsolute(outdir)) {
    modelPath = path.resolve(outdir, 'models')
    apiPath = path.resolve(outdir, 'api')
  } else {
    outdir = path.resolve(process.cwd(), outdir)
    modelPath = path.resolve(process.cwd(), outdir, 'models')
    apiPath = path.resolve(process.cwd(), outdir, 'api')
  }
  if (!existsSync(outdir)) {
    mkdirSync(outdir)
  }

  const refRe = version === 'v3' ? 'components/schemas' : 'definitions';

  !existsSync(modelPath) && mkdirSync(modelPath)
  !existsSync(apiPath) && mkdirSync(apiPath)
  let allcode = ``
  if (!url) {
    url = `http://192.168.1.105:8080/v2/api-docs`
  }

  let code: swaggerJson | undefined

  try {
    let { data }: { data: swaggerJson } = await axios.get(url)
    code = data
  } catch (error) {
    console.log(error);
  }

  if (!code) return
  function initialToUpperCase(str: string): string {
    return str.substr(0, 1).toUpperCase() + str.substr(1)
  }
  function getTime(): string {
    const date = new Date()
    const Y = date.getFullYear() + '-'
    const M = (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) + '-'
    const D = date.getDate() + ' '
    const h = date.getHours() + ':'
    const m = date.getMinutes() + ':'
    const s = date.getSeconds()
    return Y + M + D + h + m + s
  }

  // 只取最后的
  function getFuncName(src: string) {
    const reg = /[/]([^/]*$)/
    const result = reg.exec(src)
    return result && result[1].replace(/[_-]+[a-zA-Z]/, str => str[str.length - 1].toUpperCase())
  }
  // 全路径
  // function getFuncName(url: string):string {
  //   let reg = /[/-]([^/-]*)/g;
  //   let str:RegExpExecArray | null = null, first:boolean = true, allStr:string = "";
  //   while (str = reg.exec(url)) {
  //     if (first) {
  //       allStr = allStr + str[1];
  //       first = false;
  //     } else {
  //       allStr = allStr + initialToUpperCase(str[1]);
  //     }
  //   }
  //   return allStr;
  // }

  function checkRequired(key: string, definition: swaggerDefinition): string {
    return definition.required && definition.required.includes(key) ? '' : '?'
  }
  function reviseType(prop: swaggerProperty, imports?: Set<string>): string {
    if (prop['$ref']) {
      const match = prop['$ref'].match(new RegExp(`#/${refRe}/([A-z]*)$`))
      if (match) {
        if (imports) imports.add(match[1])
        return match[1]
      }
    }
    if (prop.type === 'integer') return 'number'
    if (prop.type === 'array') return `${reviseType(prop.items, imports)}[]`
    return prop.type
  }

  function getQuerysCode(querys: Array<swaggerParameter>) {
    return querys.map((item, index) => {
      return `${item.name}${item.required ? '' : '?'}: any`
    }).join(', ')
  }
  const modelIndexCode: Array<string> = []
  const definitions = (code.components?.schemas || code.definitions) as swaggerDefinitions
  for (const [key, definition] of Object.entries(definitions)) {
    const imports: Set<string> = new Set()
    let code = `${definition.description ? `/**${definition.description} */\n` : ''
      }export interface ${definition.title} {
  ${Object.entries(definition.properties).map(([key, prop]) => {
        return `    ${prop.description ? `/**  ${prop.description} */\n    ` : ''
          }${key + checkRequired(key, definition)} : ${reviseType(prop, imports)}`
      }).join(',\n')
      }
  }
`

    if (imports.size) code = `import { ${[...imports].join(', ')} } from './index'\n` + code
    const modelFileName = `${key}`
    writeFileSync(path.resolve(modelPath, `${modelFileName}.d.ts`), code)
    modelIndexCode.push(`export * from ${`'./${modelFileName}'\n`}`)
    allcode = allcode + code
  }
  writeFileSync(path.resolve(modelPath, 'index.ts'), modelIndexCode.join(''))

  const tagsCodes: { [key: string]: Array<string> } = {} // 每个tag下所有的代码 最终生成文件
  const bodyTypes: { [key: string]: Set<string> } = {} // 所有要引入的body实体类 为了不重复引入 这里用Set

  // 预先把所有的prop添加好
  code.tags.map((item) => {
    tagsCodes[item.name] = ["import request from '@/utils/request'\n"]
    bodyTypes[item.name] = new Set([])
  })
  // 循环接口
  for (const [url, path] of Object.entries(code.paths)) {
    const funcName = getFuncName(url)
    let needConfig = true
    // 循环接口method类型
    for (const [key, method] of Object.entries(path)) {
      // let bodyType: RegExpMatchArray | null = null //  body的实体类
      const querys: Array<swaggerParameter> = [] //  query参数集合
      method.parameters && method.parameters.map((item) => {
        // 这里简单的用 请求方式来区分 body和query
        if (key === 'get') {
          querys.push(item)
        } else if (item.in === 'formData') {
          needConfig = true
        }
      })
      const { bodyType, bodySchema, hasParameters } = getBody(method, key, version)
      if (bodyType) {
        bodyTypes[method.tags[0]].add(bodyType[1])
      }

      const outFuncName = funcName + initialToUpperCase(key)
      const outParameters = () => {
        let temp = ''
        if (hasParameters) {
          if (key !== 'get') {
            temp = `data: ${bodyType ? bodyType[1] : bodySchema ? reviseType(bodySchema) : 'any'}`
          } else {
            temp = `params:{ ${getQuerysCode(querys)}}`
          }
          return temp + (needConfig ? ', config?: object' : '')
        } else {
          return ''
        }
      }
      const outData = hasParameters ? key === 'get' ? 'params' : 'data' : ''

      // 当前接口的代码
      const pathCode: string = `${(function () {
        if (querys.length) {
          return `
/**
  * @description ${method.description || '详情'}
  * @date ${getTime()}
  * @param {object} params
${querys.map(item => {
            return `  * @param {any} params.${item.name}${item.required ? '' : '?'} - ${item.description}`
          }).join('\n')}
  * @returns {AxiosPromise} request
  */`
        } else {
          return `
/** @description ${method.description || '详情'} */`
        }
      }())}
export function ${outFuncName}(${outParameters()}) {
  return request({
    url: '${url}',
    method: '${key}'${hasParameters ? ',' : ''}
    ${outData}${needConfig ? ',' : ''}
    ${needConfig && hasParameters ? '...config' : ''}
  })
}
`
      tagsCodes[method.tags[0]].push(pathCode)
    }
  }
  // 遍历插入引入body类型
  Object.entries(tagsCodes).map(([key, item]) => {
    const _bodyTypes = Array.from(bodyTypes[key])
    if (_bodyTypes.length) {
      item.splice(1, 0, `import { ${_bodyTypes.join(', ')} } from '${'../models'}'`)
    }
  })

  // 按tag分类写入文件
  code.tags.map((item) => {
    writeFileSync(
      path.resolve(apiPath, `${item.name}.ts`),
      tagsCodes[item.name].join('')
    )
  })

  // 所有接口写入一个文件
  //  writeFileSync('123.ts', allcode)
}
